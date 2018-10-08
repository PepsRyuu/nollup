import { Component } from 'preact';
import './Counter.css';

export default class Counter extends Component {
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
        return <div class="Counter">Counter: {this.state.count}</div>
    }
}