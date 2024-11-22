import React from 'react';
import { storiesOf } from '@storybook/react-native';
import { withKnobs } from '@storybook/addon-knobs';
import Wrapper from '../../Wrapper';
import { Example as EventError } from './EventError';
import { Example as UIError } from './UIError';

storiesOf('ErrorTest', module)
  .addDecorator(withKnobs)
  .addDecorator((getStory: any) => <Wrapper>{getStory()}</Wrapper>)
  .add('EventError', () => <EventError/>)
  .add('UIError', () => <UIError/>)
  