import React, { useState } from 'react';
import {
  Button,

  Center,
} from 'native-base';

export function Example() {
 const [showError,setShowError] = useState(false);

 if(showError){
  throw new Error("I am a UI Error")
 }
  return (
    <Center>
      <Button id="UI_Error_Button" onPress={() => {
        setShowError(!showError)
      }}>UI Error</Button>
    </Center>
  );
}
