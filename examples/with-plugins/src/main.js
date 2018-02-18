import { render, h } from 'preact';
import Message from './Message';
import { MY_CONSTANT } from './Constants';
import './style.less';

render(h('div', null, new Message().getResponse()), document.body);
render(h('div', null, MY_CONSTANT), document.body);