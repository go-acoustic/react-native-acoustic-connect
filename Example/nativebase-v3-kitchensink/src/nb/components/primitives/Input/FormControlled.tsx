import React from 'react';
import { Input, FormControl, WarningOutlineIcon, Box } from 'native-base';

export const Example = () => {
  return (
    <Box alignItems="center">
      <FormControl isInvalid w="75%" maxW="300px">
        <FormControl.Label accessibilityHint='Test Masking'>Password test accessibility masking</FormControl.Label>
        <Input placeholder="Enter password" accessibilityHint='Test Masking' />
        <FormControl.ErrorMessage leftIcon={<WarningOutlineIcon size="xs" />}>
          Try different from previous passwords.
        </FormControl.ErrorMessage>
      </FormControl>
    </Box>
  );
};
