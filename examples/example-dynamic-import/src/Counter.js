import React , { Component } from 'react';
import './Counter.css';

//#if _DEBUG
import ReactHotLoader from 'react-hot-loader';
//#endif

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

//#if _DEBUG 
Counter = ReactHotLoader.hot(module)(Counter);
//#endif

export default Counter;