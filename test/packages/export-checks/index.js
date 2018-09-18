export var MyVar = 'MyVar';

export class MyClass {
    getValue () {
        return 'MyClass';
    }
}

export { MyVar as MyVarAlias, MyClass as MyClassAlias };

export default MyVar + MyVar + MyVar;