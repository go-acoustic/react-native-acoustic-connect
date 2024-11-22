import React, {Component} from "react";
import TLTRN from '../TLTRN';


class ConnectProfiler extends Component {
  startTime = 0
  endTime = 0

  constructor(props){
    super(props)
    this.startTime = (new Date()).getTime();

  }

  componentDidMount(){
    this.endTime = (new Date()).getTime();
    const pageLoadTime  = this.endTime - this.startTime
    const {profileName} = this.props

    if(profileName){
      TLTRN.logCustomEvent("Load Time",{profileName, pageLoadTime},1)
    }
  }

  render(){
   return this.props.children
  }
}

export default ConnectProfiler;