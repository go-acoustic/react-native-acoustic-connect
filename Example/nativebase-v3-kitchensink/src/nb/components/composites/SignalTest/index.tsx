import React from 'react';
// import { storiesOf } from '@storybook/react-native';
// import { withKnobs } from '@storybook/addon-knobs';
import Wrapper from '../../nb/components/Wrapper';
import { Example as EventSignal } from './EventSignal';

storiesOf('SignalTest', module)
  .addDecorator(withKnobs)
  .addDecorator((getStory: any) => <Wrapper>{getStory()}</Wrapper>)
  .add('EventSignal', () => <EventSignal/>)
  