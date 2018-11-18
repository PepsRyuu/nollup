import Counter from './Counter';
import { Internal } from './Internal';
import Switch from './Switch';
import './App.css';
import React from 'react';

//#if _DEBUG
import ReactHotLoader from 'react-hot-loader';
//#endif

let App = () => (
    <div className="App">
        <h1>Hello World</h1>
        <Internal />
        <Counter />
        <Switch />
    </div>
);

//#if _DEBUG 
App = ReactHotLoader.hot(module)(App);
//#endif

export default App;
