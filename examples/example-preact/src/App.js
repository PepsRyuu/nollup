import Counter from './Counter';
import { Internal } from './Internal';
import Switch from './Switch';
import './App.css';
import HotManager from './HotManager';

let App = () => (
    <div class="App">
        <h1>Hello World</h1>
        <Internal />
        <Counter />
        <Switch />
    </div>
);

if (module) {
    App = HotManager.register(App, module);
}

export default App;