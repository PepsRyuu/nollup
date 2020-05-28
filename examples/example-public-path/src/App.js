import React, { Component } from 'react';
import './App.css';

class App extends Component {
    
    constructor () {
        super();

        this.activeComponent = undefined;
    }

    componentDidMount () {
        import('./Counter').then(component => {
            this.activeComponent = component.default;
            this.forceUpdate();
        });
    }

    render () {
        let ActiveComponent = this.activeComponent;

        return (
            <div className="App">
                <h1>Hello World</h1>
                {this.activeComponent && <ActiveComponent />}
            </div>
        );

    }
}

if (process.env.NODE_ENV === 'development') {
    App = require('react-hot-loader').hot(module)(App);
}

export default App;