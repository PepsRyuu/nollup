import React , { Component } from 'react';
import './Counter.css';

class Counter extends Component {
    constructor () {
        super();

        this.state = {
            count: 0 
        };
    }

    componentDidMount() {
        this.interval = setInterval(() => {
            this.setState({
                count: this.state.count + 1
            })
        }, 200);
    }

    componentWillUnmount() {
        clearInterval(this.interval)
    }

    render() {
        return <div className="Counter">Counter: {this.state.count}</div>
    }
}

if (process.env.NODE_ENV === 'development') {
    Counter = require('react-hot-loader').hot(module)(Counter);
}

export default Counter;