const fetch = require('node-fetch');

module.exports = {
    sendMail: function (config, params_) {
        let params = {
            user_id: config.emailjs.userid,
            service_id: config.emailjs.serviceid,
            template_id: config.emailjs.templateid,
            template_params: params_
        };
        let headers = {
            'Content-type': 'application/json'
        };
      
        let options = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(params)
        };

        fetch('https://api.emailjs.com/api/v1.0/email/send', options)
            .then((httpResponse) => {
                if (httpResponse.ok) {
                    console.log('Mail sent with change data');
                } else {
                    return httpResponse.text()
                    .then(text => Promise.reject(text));
                }
            })
            .catch((error) => {
                console.log('Some error in sending mail : ' + error);
            });
    }
  };