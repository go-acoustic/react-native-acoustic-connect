/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import type { LayoutChangeEvent } from "react-native"; // Use type-only import for LayoutChangeEvent
import TLTRN from '../TLTRN';

interface ConnectProps {
    children: React.ReactNode;
    captureKeyboardEvents: boolean;
    captureDialogEvents?: boolean; // New prop for dialog event capture
    /**
     * Preferred: an explicit NavigationContainer ref obtained from
     * `useNavigationContainerRef()`. Using this prop decouples <Connect> from
     * any assumption about the children structure and is the recommended
     * integration path.
     *
     * If omitted, <Connect> falls back to (a) inspecting the direct child's
     * own ref, then (b) auto-injecting an internal ref via cloneElement.
     * Every path degrades gracefully — if no usable ref is resolved,
     * screen-name tracking is disabled but touches still reach host components.
     */
    navigationRef?: React.RefObject<any>;
}

const Connect: React.FC<ConnectProps> = ({
    children,
    captureKeyboardEvents,
    captureDialogEvents = false,
    navigationRef,
}) => {
    const child = children as any;
    // React 19 moved the ref off `element.ref` onto `element.props.ref`.
    // Read `props.ref` first; the legacy `child.ref` fallback is a defensive
    // guard from the React 18 era — kept to avoid a behavioural change.
    const childProvidedRef = child?.props?.ref ?? child?.ref;
    const internalRef = useRef<any>(null);

    // Resolution order (explicit → legacy child ref → auto-injected fallback).
    // The chosen ref flows through the same mount-effect / touch / layout
    // guards, so any path that fails to resolve a usable navigation container
    // simply disables tracking rather than breaking host-app gestures.
    const navigation = navigationRef ?? childProvidedRef ?? internalRef;
    const shouldInjectRef =
        !navigationRef && !childProvidedRef && React.isValidElement(child);

    const currentRoute = useRef<string | undefined>(undefined);
    const initial = useRef<boolean>(false);
    // Tracks whether the resolved navigation ref has actually attached. See the
    // readiness effect below for why a one-shot mount check is insufficient.
    const [navReady, setNavReady] = useState<boolean>(false);

    useEffect(() => {
        TLTRN.interceptKeyboardEvents(captureKeyboardEvents);
    }, [captureKeyboardEvents]);

    useEffect(() => {
        TLTRN.interceptDialogEvents(captureDialogEvents);
    }, [captureDialogEvents]);

    // Wait for the NavigationContainer ref to actually attach before declaring
    // it usable. When <Connect> wraps the container indirectly — intermediate
    // providers (AppProvider, SafeAreaProvider, …), or any provider that defers
    // rendering its subtree (async init, splash gate) — the container mounts
    // AFTER <Connect>'s effects run, so `navigation.current` is still null at
    // first paint. A one-shot mount check would warn and permanently disable
    // tracking, because the effect's only dependency is the stable ref object
    // and `.current` mutations don't retrigger effects. So we poll until the
    // ref is usable, then flip `navReady` to subscribe. The direct-child case
    // resolves on the first synchronous check (no polling, no warning). If the
    // ref never attaches within the grace window we warn once, as before.
    useEffect(() => {
        // Reset readiness whenever the resolved ref changes. Without this, a
        // `navigationRef` prop swap leaves `navReady` stale-true, so the
        // subscription effect below re-runs and attaches `addListener` to the
        // old container (whose `.current` is still non-null mid-transition)
        // before the new ref is validated. Resetting forces re-validation
        // through `isUsable()` before tracking re-enables.
        setNavReady(false);

        const isUsable = () =>
            !!navigation &&
            !!navigation.current &&
            typeof navigation.current.addListener === "function" &&
            typeof navigation.current.getCurrentRoute === "function";

        if (isUsable()) {
            setNavReady(true);
            return;
        }

        let attempts = 0;
        const POLL_INTERVAL_MS = 100;
        const MAX_ATTEMPTS = 100; // ~10s grace for deferred/async provider init
        let timer: ReturnType<typeof setTimeout> | undefined;

        const poll = () => {
            if (isUsable()) {
                setNavReady(true);
                return;
            }
            if (attempts++ >= MAX_ATTEMPTS) {
                console.warn(
                    "Connect: navigation tracking disabled — no usable NavigationContainer ref resolved. " +
                    "Pass `navigationRef` (from useNavigationContainerRef()) or ensure a NavigationContainer is rendered under <Connect>."
                );
                return;
            }
            timer = setTimeout(poll, POLL_INTERVAL_MS);
        };
        timer = setTimeout(poll, POLL_INTERVAL_MS);

        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [navigation]);

    useEffect(() => {
        if (!navReady || !navigation?.current) {
            return;
        }

        // Listen for the 'state' event to track navigation state changes
        const unsubscribeState = navigation.current.addListener("state", () => {
            // extractName resolves the focused route through the nested
            // navigators itself, so there is no outer-level fallback to chain
            // here — one used to be appended, which reported the tab name for
            // every push inside that tab.
            currentRoute.current = extractName(navigation);

            // Both platforms take the same path. iOS used to be excluded from
            // the layout call, which left the wrapper with no layout trigger
            // at all there: the one remaining bridge caller was TLTRN's
            // render-settle timer, so a plain navigation captured nothing.
            if (!currentRoute.current) {
                return;
            }
            TLTRN.logScreenViewPageName(currentRoute.current);
            // Deliberately no delay argument. TLTRN then sends its
            // "use the configured CaptureLayoutDelay" sentinel, so the capture
            // is deferred past the transition. Passing 0 would select the
            // native synchronous overload instead, which captures on the
            // calling thread at the *start* of the transition — React
            // Navigation fires 'state' before the animation runs — and makes
            // CaptureLayoutDelay inert.
            TLTRN.logScreenLayout(currentRoute.current);
        });

        // Cleanup listeners when the component unmounts or dependencies change
        return () => {
            unsubscribeState();
        };
    }, [navReady, navigation]);

    const onStartShouldSetResponderCapture = useCallback((event: any) => {
        currentRoute.current = extractName(navigation);
        if (currentRoute.current) {
            TLTRN.logScreenViewPageName(currentRoute.current);
        }
        TLTRN.logClickEvent(event);
        return false; // Must remain false so events bubble to the host app's handlers
    }, [navigation]);

    const onLayout = useCallback((_event: LayoutChangeEvent) => {
        if (initial.current) {
            return false;
        }
        initial.current = true;

        // Resolved through extractName like the other two triggers. This site
        // used to read `getCurrentRoute()?.name` directly, so a `params.name`
        // override was honoured on navigation but silently ignored for the
        // first-paint screen — the same screen reported under two names.
        currentRoute.current = extractName(navigation);
        // Same unification as the 'state' listener above: the split sent
        // only a screenview on iOS and only a layout on Android, so
        // neither platform got both from the first-paint trigger. No delay
        // argument, for the reason given there.
        if (currentRoute.current) {
            TLTRN.logScreenViewPageName(currentRoute.current);
            TLTRN.logScreenLayout(currentRoute.current);
        }
        return true;
    }, [navigation]);

    return (
        <View
            style={styles.connect_main}
            onLayout={onLayout}
            onStartShouldSetResponderCapture={onStartShouldSetResponderCapture}
        >
            {shouldInjectRef
                ? React.cloneElement(child as React.ReactElement<any>, { ref: internalRef })
                : children}
        </View>
    );
};

/**
 * Walks a React Navigation state down to the deepest **focused** route.
 *
 * Nested navigators are the default architecture of production RN apps: a tab
 * navigator whose tabs each hold a stack. The container's root state then
 * describes only the outer level, and the route that the user is actually
 * looking at lives in `routes[index].state`, recursively. Reading the outer
 * level alone reports the *tab* name for every push inside that tab, so screen
 * changes below the first level are invisible to analytics and replay.
 *
 * `index` can legitimately be absent on a partial/rehydrated state, in which
 * case React Navigation treats the last route as focused — matched here.
 *
 * A depth cap guards against a malformed state whose nesting cycles; 32 is far
 * past any real navigator tree.
 */
function findFocusedRoute(state: any): any {
    let current = state;
    let depth = 0;
    while (current?.routes?.length && depth++ < 32) {
        const index = current.index ?? current.routes.length - 1;
        const route = current.routes[index];
        if (!route?.state?.routes?.length) {
            return route;
        }
        current = route.state;
    }
    return undefined;
}

/**
 * Containers already reported by {@link warnExtractNameFailed}.
 *
 * Keyed by the container itself, so a ref that throws on every navigation
 * produces one line rather than one per transition, while a genuinely
 * different container still gets its own. A `WeakSet` holds no strong
 * reference, so remembering a container cannot keep it alive.
 */
const extractNameErrorReported = new WeakSet<object>();

/**
 * Reports, once per container, that resolving the current route threw.
 *
 * A throw here is expected and harmless during teardown, which is why
 * ``extractName`` swallows it. A ref that keeps throwing is a different
 * matter: every screen view goes unnamed, and without a line here that looks
 * exactly like a ref that never attached. One warning separates the two
 * without flooding a listener that fires per navigation.
 */
function warnExtractNameFailed(container: unknown, error: unknown) {
    if (typeof container === "object" && container !== null) {
        if (extractNameErrorReported.has(container)) {
            return;
        }
        extractNameErrorReported.add(container);
    }
    console.warn(
        "Connect: could not resolve the current route — the navigation container ref threw. " +
        "Screen views stay unnamed while this persists (harmless if the container is unmounting). " +
        "Cause:",
        error
    );
}

/**
 * The screen name to report for the navigation container's current position.
 *
 * Resolution order:
 *
 * 1. The focused route resolved from `getRootState()` by ``findFocusedRoute``.
 *    Taking the state and walking it here — rather than trusting a single
 *    accessor — keeps the wrapper correct regardless of whether the host app's
 *    navigation library resolves nesting inside `getCurrentRoute()`, and works
 *    for a custom container ref that exposes state but not that helper.
 * 2. `getCurrentRoute()`, for refs that expose no `getRootState`.
 *
 * Either way `params.name` wins over the route's own `name` when the host app
 * supplies it — the documented override for giving a route a human-readable
 * analytics name. Only a non-empty string counts, so `params: { name: '' }`
 * falls through to the route name instead of blanking the screenview.
 *
 * Returns `""` when nothing resolves, which both callers treat as "skip".
 */
function extractName(navigation: any): string {
    const container = navigation?.current;
    if (!container) {
        return "";
    }

    let route: any;
    try {
        route = findFocusedRoute(container.getRootState?.());
    } catch (error) {
        // A container mid-teardown can throw out of getRootState(). Screen
        // naming is not worth taking the host app's navigation down for.
        warnExtractNameFailed(container, error);
        route = undefined;
    }
    if (!route) {
        try {
            route = container.getCurrentRoute?.();
        } catch (error) {
            warnExtractNameFailed(container, error);
            route = undefined;
        }
    }
    if (!route) {
        return "";
    }

    const overridden = route.params?.name;
    if (typeof overridden === "string" && overridden.length > 0) {
        return overridden;
    }
    return typeof route.name === "string" ? route.name : "";
}

export default Connect;

const styles = StyleSheet.create({
    connect_main: {
        flex: 1,
    },
});