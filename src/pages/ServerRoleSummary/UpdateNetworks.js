// (c) Copyright 2017 SUSE LLC
/**
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**/
import React, { Component } from 'react';
import { fromJS } from 'immutable';
import { translate } from '../../localization/localize.js';
import { ServerInputLine, ServerDropdownLine, ServerInput } from '../../components/ServerUtils.js';
import { ActionButton } from '../../components/Buttons.js';
import { alphabetically } from '../../utils/Sort.js';
import {
  IpV4AddressValidator, VLANIDValidator, CidrValidator, UniqueNameValidator, AddressesValidator
} from '../../utils/InputValidators.js';
import { MODE, INPUT_STATUS } from '../../utils/constants.js';
import HelpText from '../../components/HelpText.js';

class UpdateNetworks extends Component {
  constructor(props) {
    super(props);
    this.networkGroups = this.getNetworkGroups();
    this.data = this.props.mode === MODE.EDIT ? this.getNetworkData(this.props.networkName) : {};
    this.allInputsStatus = {
      'name': INPUT_STATUS.UNKNOWN,
      'vlanid': INPUT_STATUS.UNKNOWN,
      'cidr': INPUT_STATUS.UNKNOWN,
      'gateway-ip': INPUT_STATUS.UNKNOWN
    };

    this.allAddressesStatus = [];

    this.state = {
      isFormValid: false,
      isFormChanged: false,
      addresses: this.initAddresses(),
      isTaggedChecked:
        this.data['tagged-vlan'] !== '' && this.data['tagged-vlan'] !== undefined ?  this.data['tagged-vlan'] : false,
    };
  }

  initAddresses() {
    // for UI state addresses
    let retAddresses = this.data['addresses'] ? this.data['addresses'] : [];

    // init validation status
    this.allAddressesStatus = retAddresses.map((addr) => {
      return INPUT_STATUS.VALID;
    });
    return retAddresses;
  }

  getNetworkData(name) {
    let network =
      this.props.model.getIn(['inputModel','networks']).find(net => net.get('name') === name);
    return JSON.parse(JSON.stringify(network));
  }

  isFormTextInputValid() {
    let isAllValid = true;
    let values = Object.values(this.allInputsStatus);
    isAllValid =
      (values.every((val) => {return val === INPUT_STATUS.VALID || val === INPUT_STATUS.UNKNOWN;})) &&
      this.allInputsStatus['name'] !== INPUT_STATUS.UNKNOWN &&
      this.allInputsStatus['vlanid'] !== INPUT_STATUS.UNKNOWN && (
        this.allAddressesStatus.length === 0 || this.allAddressesStatus.every((val) => {
          return val === INPUT_STATUS.VALID;
        })
      );

    return isAllValid;
  }

  isFormDropdownValid() {
    let isValid = true;
    if(this.data['network-group'] === '' || this.data['network-group'] === undefined) {
      isValid = false;
    }
    return isValid;
  }

  updateFormValidity = (props, isValid) => {
    this.allInputsStatus[props.inputName] = isValid ? INPUT_STATUS.VALID : INPUT_STATUS.INVALID;
    this.setState({isFormValid: this.isFormTextInputValid() && this.isFormDropdownValid()});
  }

  handleSelectNetworkGroup = (groupName) => {
    this.data['network-group'] = groupName;
    if(!this.state.isFormChanged) {
      this.setState({isFormChanged: true});
    }
    this.setState({isFormValid: this.isFormTextInputValid() && this.isFormDropdownValid()});
  }

  handleInputChange = (e, isValid, props) => {
    let value = e.target.value;
    this.updateFormValidity(props, isValid);
    if (isValid) {
      if(!this.state.isFormChanged) {
        this.setState({isFormChanged: true});
      }
      if(props.inputName === 'vlanid') {
        value = parseInt(value);
      }

      this.data[props.inputName] = value;
    }
  }

  handleAddressChange = (e, isValid, props, idx) => {
    let value = e.target.value;
    if (isValid) {
      if(!this.state.isFormChanged) {
        this.setState({isFormChanged: true});
      }
      this.allAddressesStatus[idx] = INPUT_STATUS.VALID;

      // this.data is the final result to be saved into model, init if we don't have any
      // addresses will be processed when save later
      if(!this.data['addresses']) {
        this.data['addresses'] = [];
      }
    }
    else {
      this.allAddressesStatus[idx] = INPUT_STATUS.INVALID;
    }

    this.setState(prev => {
      let addresses = prev.addresses.slice();
      addresses[idx] = value;
      return {addresses: addresses};
    });
    this.updateFormValidity(props, isValid);
  }

  handleUpdateNetwork = () => {
    let model = this.props.model;
    for (let key in this.data) {
      if(this.data[key] === undefined || this.data[key] === '') {
        delete this.data[key];
      }

      if (key === 'addresses') {
        let cleanAddrs = this.state.addresses.filter(addr => addr !== '');
        if (cleanAddrs.length === 0) {
          delete this.data[key];
        }
        else {
          this.data[key] = cleanAddrs;
        }
      }
    }

    if(this.props.mode === MODE.ADD) {
      model = model.updateIn(
        ['inputModel', 'networks'], net => net.push(fromJS(this.data)));
      this.props.updateGlobalState('model', model);
    }
    else {
      let idx = model.getIn(['inputModel','networks']).findIndex(
        net => net.get('name') === this.props.networkName);
      model = model.updateIn(['inputModel', 'networks'],
        net => net.splice(idx, 1, fromJS(this.data)));
      this.props.updateGlobalState('model', model);
    }
    this.props.closeAction();
  }

  handleTaggedVLANChange = () => {
    this.data['tagged-vlan'] = !this.state.isTaggedChecked;
    if(!this.state.isFormChanged) {
      this.setState({isFormChanged: true});
    }
    this.setState({isTaggedChecked: !this.state.isTaggedChecked});
  }

  getNetworkGroups = () => {
    return this.props.model.getIn(['inputModel','network-groups']).map(e => e.get('name'))
      .toJS()
      .sort(alphabetically);
  }

  removeAddress = (idx) => {
    this.setState(prev => {
      let addresses = prev.addresses.slice();
      addresses.splice(idx, 1);
      return {addresses: addresses, isFormChanged: true};
    });
    // remove status
    this.allAddressesStatus.splice(idx, 1);
  }

  addAddress = () => {
    this.setState(prev => {
      let addresses = prev.addresses.slice();
      addresses.push(''); //empty input
      return {addresses: addresses};
    });
  }

  renderNewAddressInput () {
    return (
      <div key={0} className='dropdown-plus-minus'>
        <div className="field-container">
          <ServerInput
            inputAction={(e, valid, props) => this.handleAddressChange(e, valid, props, 0)}
            inputType='text' inputValue={''} inputValidate={AddressesValidator}
            isRequired='false' placeholder={translate('network.addresses')}/>
        </div>
      </div>
    );
  }

  renderNetworkAddresses () {
    if(this.state.addresses.length === 0) {
      return this.renderNewAddressInput();
    }
    let addressRows = this.state.addresses.map((addr, idx) => {
      const lastRow = (idx === this.state.addresses.length -1);
      return (
        <div key={idx} className='dropdown-plus-minus'>
          <div className="field-container">
            <ServerInput
              inputAction={(e, valid, props) => this.handleAddressChange(e, valid, props, idx)}
              inputType='text' inputValue={addr} inputValidate={AddressesValidator}
              isRequired='false' placeholder={translate('network.addresses')}/>
          </div>
          <div className='plus-minus-container'>
            { idx > 0 || (addr !== '') ?
              <span key={'address_minus'} className={'fa fa-minus left-sign'}
                onClick={() => this.removeAddress(idx)}/>
              : ''}
            { lastRow && (this.allAddressesStatus[idx] !== INPUT_STATUS.INVALID && addr !== '') ?
              <span key={'address_plus'} className={'fa fa-plus right-sign'}
                onClick={this.addAddress}/>
              : ''}
          </div>
        </div>
      );
    });

    return addressRows;
  }

  renderNetworkInput(name, type, isRequired, placeholderText, validate) {
    let extraProps = {};
    //for vlanid
    if(type === 'number') {
      extraProps.min = 1;
      extraProps.max = 4094;
    }

    if(name === 'name') {
      extraProps.names =
        this.props.model.getIn(['inputModel','networks']).map(e => e.get('name'))
          .toJS();
      if(this.props.mode === MODE.EDIT) {
        //remove current name so won't check against it
        let idx = this.props.model.getIn(['inputModel','networks']).findIndex(
          net => net.get('name') === this.props.networkName);
        extraProps.names.splice(idx, 1);
      }
      extraProps.check_nospace=true;
    }

    if(this.props.mode === MODE.EDIT) {
      extraProps.updateFormValidity = this.updateFormValidity;
    }

    return (
      <ServerInputLine
        isRequired={isRequired} inputName={name} inputType={type}
        placeholder={placeholderText} inputValidate={validate}
        inputValue={this.props.mode === MODE.EDIT ? this.data[name] : ''} {...extraProps}
        inputAction={this.handleInputChange}/>
    );
  }

  renderNetworkGroup() {
    let emptyOptProps = '';
    if(this.data['network-group'] === '' || this.data['network-group'] === undefined) {
      emptyOptProps = {
        label: translate('network.group.please.select'),
        value: 'noopt'
      };
    }
    return (
      <ServerDropdownLine value={this.data['network-group']}
        optionList={this.networkGroups} isRequired={true}
        emptyOption={emptyOptProps} selectAction={this.handleSelectNetworkGroup}/>
    );
  }

  renderTaggedVLAN() {
    return (
      <div className='tagged-vlan'>
        <input className='tagged' type='checkbox' value='taggedvlan'
          checked={this.state.isTaggedChecked} onChange={this.handleTaggedVLANChange}/>
        {translate('tagged-vlan')}
      </div>
    );
  }
  render() {
    let title =
      this.props.mode === MODE.EDIT ? translate('network.update') : translate('network.add');
    return (
      <div className='details-section network-section'>
        <div className='details-header'>{title}</div>
        <div className='details-body'>
          {this.renderNetworkInput('name', 'text', true, translate('network.name') + '*', UniqueNameValidator)}
          <div className='details-group-title'>{translate('vlanid') + '*:'}
            <HelpText tooltipText={translate('tooltip.network.vlanid')}/></div>
          {this.renderNetworkInput('vlanid', 'number', true, translate('vlanid'), VLANIDValidator)}
          <div className='details-group-title'>{translate('cidr') + ':'}
            <HelpText tooltipText={translate('tooltip.network.cidr')}/></div>
          {this.renderNetworkInput('cidr', 'text', false, translate('cidr'), CidrValidator)}
          <div className='details-group-title'>{translate('network.addresses') + ':'}
            <HelpText tooltipText={translate('tooltip.network.addresses')}/></div>
          {this.renderNetworkAddresses()}
          <div className='details-group-title'>{translate('network.gateway') + ':'}</div>
          {this.renderNetworkInput('gateway-ip', 'text', false, translate('network.gateway'), IpV4AddressValidator)}
          <div className='details-group-title'>{translate('network.group') + '*:'}</div>
          {this.renderNetworkGroup()}
          {this.renderTaggedVLAN()}
          <div className='btn-row details-btn network-more-width'>
            <div className='btn-container'>
              <ActionButton key='networkCancel' type='default' clickAction={this.props.closeAction}
                displayLabel={translate('cancel')}/>
              <ActionButton key='networkSave' clickAction={this.handleUpdateNetwork}
                displayLabel={translate('save')} isDisabled={!this.state.isFormValid || !this.state.isFormChanged}/>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default UpdateNetworks;
