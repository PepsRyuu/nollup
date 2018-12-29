import React, { Component } from 'react';
import './App.css';

//#if _DEBUG
import ReactHotLoader from 'react-hot-loader';
//#endif

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

//#if _DEBUG 
App = ReactHotLoader.hot(module)(App);
//#endif

export default App;