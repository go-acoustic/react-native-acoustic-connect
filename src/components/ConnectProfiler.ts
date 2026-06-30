/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

import React, { Component } from "react";
import TLTRN from "../TLTRN";

interface ConnectProfilerProps {
  profileName?: string; // Optional property
  children?: React.ReactNode; // For rendering child components
}

class ConnectProfiler extends Component<ConnectProfilerProps> {
  startTime = 0;
  endTime = 0;

  constructor(props: ConnectProfilerProps) {
    super(props);
    this.startTime = new Date().getTime();
  }

  componentDidMount() {
    this.endTime = new Date().getTime();
    const pageLoadTime = this.endTime - this.startTime;
    const { profileName } = this.props;

    if (profileName) {
      TLTRN.logCustomEvent("Load Time", { profileName, pageLoadTime }, 1);
    }
  }

  render() {
    return this.props.children;
  }
}

export default ConnectProfiler;