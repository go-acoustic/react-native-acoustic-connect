import { Keyboard, Platform, TextInput } from "react-native";

class KeyboardListener{
    static TLTRN = null;
    static listener = null;
    
    static _instance(_TLTRN){
        if(!KeyboardListener.listener){ KeyboardListener.listener = new KeyboardListener(_TLTRN); }
        return KeyboardListener.listener;
    }
    
    constructor(_TLTRN) { 
        KeyboardListener.TLTRN = _TLTRN;
        
        this.enabled = false;
        let _x = {};
        let _i = {};
        
        const sanitize = (target, text) => {
            if(!_x[target].secureTextEntry || typeof _x[target].secureTextEntry === 'undefined'){ return text; }
            return new Array(text.length).fill('*').join('');
        };
        const flushData = () => { 
            _i = {}; 
            _x = {}; 
        };
        const keyListener = (evt, bubbledEvent) => {
            let _nativeTag = evt?.target?._nativeTag;

            let valid = this.enabled && (!_i[_nativeTag] || _i[_nativeTag] === bubbledEvent);
            if(!valid){ return false; }
            
            // console.log('parent keyListener evt', evt);  
            // console.log('parent keyListener evt?._targetInst?.secureTextEntry', evt?._targetInst?.memoizedProps?.secureTextEntry);  
            
            _i[_nativeTag] = bubbledEvent;
            if(!_x[_nativeTag]){ _x[_nativeTag] = { text: '' }; }
            
            _x[_nativeTag].target = evt?.target?._nativeTag;
            _x[_nativeTag].controlId = evt?._targetInst?.memoizedProps?.id;
            _x[_nativeTag].ariaLabel = evt?._targetInst?.memoizedProps?.accessible?.accessibilityLabel;
            _x[_nativeTag].secureTextEntry = evt?._targetInst?.memoizedProps?.secureTextEntry;
            
            let anon = _k => {
                if(_k !== 'Backspace' && _k.length === 1){ return _x[_nativeTag].text += sanitize(_nativeTag, _k); }
                else if(_k !== 'Backspace' && _k.length > 1){ return sanitize(_nativeTag, _k); }
                else { return _x[_nativeTag].text.slice(0, -1); }
            };
            let text = null;
            switch(bubbledEvent){
                case 'onTextInput':
                    text = evt?.nativeEvent?.text;
                    if(_k !== 'Backspace' && _k.length === 1){ _x[_nativeTag] = _x[_nativeTag].text += sanitize(_nativeTag, _k); }
                    else if(_k !== 'Backspace' && _k.length > 1){ _x[_nativeTag].text = sanitize(_nativeTag, _k); }
                    else { _x[_nativeTag].text = _x[_nativeTag].text.slice(0, -1); }
                
                break;
                case 'onKeyPress':
                    text = evt?.nativeEvent?.key;
                    _x[_nativeTag].text = anon(text);
                break;
                case 'onChange':
                    text = evt?.nativeEvent?.text;
                    _x[_nativeTag].text = sanitize(_nativeTag, text);
                break;
            } 
        };
        
        const keyboardDidHide = async () => {
            let values = Object.values(_x);
            for (let value of values) {
                let {text, controlId, ariaLabel, target} = value;
                await KeyboardListener.TLTRN.logTextChangeEvent(target, controlId, text, ariaLabel); 
            }
            flushData();
        };
        
        TextInput.defaultProps = TextInput.defaultProps || {};
            
        // Shotgun approach; if any of these listeners are set on the component the event doesn't bubble up
        // TextInput.defaultProps.onKeyPress = evt => keyListener(evt, 'onKeyPress');
        TextInput.defaultProps.onChange = evt => keyListener(evt, 'onChange');
        // TextInput.defaultProps.onTextInput = evt => keyListener(evt, 'onTextInput');
        
        Keyboard.addListener('keyboardDidHide', keyboardDidHide);
    }
    interceptKeyboardEvents(enable){ this.enabled = enable; }
}

export default KeyboardListener;