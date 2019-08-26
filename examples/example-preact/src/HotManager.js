import { Component, render } from 'preact';

let container_map = {};

export default {
    register: function (Original, module) {   
        let name = Original.name; 

        if (!container_map[name]) {
            container_map[name] = {
                instance: undefined,
                original: Original,
                container: class ComponentContainer extends Component {
                    componentDidMount () {
                        container_map[name].instance = this;
                        this.onHotUpdate();
                    }

                    onHotUpdate () {
                        let Original = container_map[name].original;
                        this.el = render(<Original {...this.props} />, this.base.parentNode, this.el);
                    }

                    render () {
                        return null;
                    }
                }
            }
        }

        container_map[name].original = Original;

        module.hot.accept(() => {
            require(module.id);
            container_map[name].instance.onHotUpdate();
        });

        return container_map[name].container;
    }
}