import Counter from './Counter';
import { Internal } from './Internal';
import Switch from './Switch';
import './App.css';
import HotManager from './HotManager';

const App = () => (
    <div class="App">
        <h1>Hello World</h1>
        <Internal />
        <Counter />
        <Switch />
    </div>
);

if (module) {
    HotManager.register(module.id);
}

export default App;