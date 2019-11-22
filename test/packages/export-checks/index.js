export var MyVar = 'MyVar';

export class MyClass {
    getValue () {
        return 'MyClass';
    }
}

export { MyVar as MyVarAlias, MyClass as MyClassAlias };

export { DepFrom } from './dep-from';

export { default as DefaultDepFrom } from './dep-from';

export { AliasDepFrom as AliasDepFromProxy } from './alias-dep-from';

export default MyVar + MyVar + MyVar;