import React from 'react';
import {
  Button,

  Center,
} from 'native-base';

import {NativeModules, findNodeHandle} from 'react-native';
const Connect = NativeModules.RNCxa;

export function Example() {
  const onSignal = () => {
      const signalObj = {
        "behaviorType": "orderConfirmation",
        "orderId": "145667",
        "orderSubtotal": 10,
        "orderShip": 10,
        "orderTax": "5.99",
        "orderDiscount": "10%",
        "currency": "USD",
      }
      Connect.logSignal(signalObj, 1).then(result => 
        {
          console.debug("Result from Signal:" + result)
        }
      )
    }
  return (
    <Center>
      <Button id="Event_Signal_Button" onPress={onSignal}>Test Signal</Button>
    </Center>
  );
}
