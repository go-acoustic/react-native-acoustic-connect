import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import AcousticConnectRN, {
  type AcousticConnectStatusInfoRNBeta,
} from 'react-native-acoustic-connect';

const test2 = AcousticConnectRN;
const result = AcousticConnectRN.logCustomEvent('test', {test: 'test'}, 1); 
console.log('result', result);

function App(): React.JSX.Element {
  // const [networkInfo, setNetworkInfo] = useState<AcousticConnectStatusInfoRNBeta | null>(
  //   null,
  // );

  // useEffect(() => {
  //   // const unsubscribe = AcousticConnectRN.addListener(networkInfo => {
  //   //   setNetworkInfo(networkInfo);
  //   // });

  //   return () => {
  //     // unsubscribe();
  //   };
  // }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Hello Test
      </Text>
      <Text style={styles.text}>
        Test 2
      </Text>
      {/* <Text>{JSON.stringify(networkInfo, null, 2)}</Text> */}
    </View>
  );
}

{/* <View style={styles.container}>
      <Text style={styles.text}>
        {AcousticConnectRN?.isConnected ? 'Connected' : 'Disconnected'}
      </Text>
      <Text style={styles.text}>
        {AcousticConnectRN?.connectionType || 'Unknown'}
      </Text>
      <Text>{JSON.stringify(networkInfo, null, 2)}</Text>
    </View> */}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 40,
    color: 'green',
  },
});

export default App;
