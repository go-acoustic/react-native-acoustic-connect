import React from 'react';
import {
  Button,

  Center,
} from 'native-base';

export function Example() {
  return (
    <Center>
      <Button id="Event_Error_Button" onPress={() => {
        throw new Error("I am an Event Error")
      }}>Test Event Error</Button>
    </Center>
  );
}
