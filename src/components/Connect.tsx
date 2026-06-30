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
import { View, StyleSheet, Platform } from "react-native";
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
    // See CA-144314.
    useEffect(() => {
        // Reset readiness whenever the resolved ref changes. Without this, a
        // `navigationRef` prop swap leaves `navReady` stale-true, so the
        // subscription effect below re-runs and attaches `addListener` to the
        // old container (whose `.current` is still non-null mid-transition)
        // before the new ref is validated. Resetting forces re-validation
        // through `isUsable()` before tracking re-enables. See CA-144314.
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
            currentRoute.current = extractName(navigation) || navigation.current.getCurrentRoute()?.name;

            if (Platform.OS === "ios" && currentRoute && currentRoute.current) {
                TLTRN.logScreenViewPageName(currentRoute.current);
            } else if (Platform.OS === "android") {
                TLTRN.logScreenViewPageName(currentRoute.current);
                TLTRN.logScreenLayout(currentRoute.current);
            }
        });

        // Cleanup listeners when the component unmounts or dependencies change
        return () => {
            unsubscribeState();
        };
    }, [navReady, navigation]);

    const onStartShouldSetResponderCapture = useCallback((event: any) => {
        if (navigation?.current?.getCurrentRoute) {
            currentRoute.current =
                extractName(navigation) || navigation.current.getCurrentRoute()?.name;
            if (currentRoute.current) {
                TLTRN.logScreenViewPageName(currentRoute.current);
            }
        }
        TLTRN.logClickEvent(event);
        return false; // Must remain false so events bubble to the host app's handlers
    }, [navigation]);

    const onLayout = useCallback((_event: LayoutChangeEvent) => {
        if (initial.current) {
            return false;
        }
        initial.current = true;

        if (navigation?.current?.getCurrentRoute) {
            currentRoute.current = navigation.current.getCurrentRoute()?.name;
            if (Platform.OS === "ios" && currentRoute.current) {
                TLTRN.logScreenViewPageName(currentRoute.current);
            } else if (Platform.OS === "android") {
                TLTRN.logScreenLayout(currentRoute.current);
            }
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

function extractName(navigation: any): string {
    const routeParams = navigation?.current?.getCurrentRoute?.()?.params;
    if (routeParams) {
        const { name } = routeParams;
        return name ? name : navigation.current?.getCurrentRoute()?.name || "";
    }
    return "";
}

export default Connect;

const styles = StyleSheet.create({
    connect_main: {
        flex: 1,
    },
});