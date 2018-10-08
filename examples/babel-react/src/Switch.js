import React, { Component } from 'react';
import './Switch.css';

export default class Switch extends Component {
    constructor () {
        super();

        this.state = {
            value: true
        };

        this.onClick = this.onClick.bind(this);
    }

    onClick () {
        this.setState({
            value: !this.state.value
        });
    }

    render() {
        return (
            <div className="Switch" data-active={this.state.value} onClick={this.onClick}>
                {this.state.value? 'On' : 'Off'}
            </div>
        );

    }
}