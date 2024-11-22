const fs = require('fs');

function isValid(path){
    let valid = false 
    try {
        if (fs.existsSync(path)) {
          valid = true
        } else {
          valid = false
        }
      } catch(e) {
        valid = false
      }

      return valid
}

module.exports = {isValid};
