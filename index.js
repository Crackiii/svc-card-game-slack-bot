const express = require('express')
const cors = require('cors')
const app = express();
const { WebClient } = require('@slack/web-api');
const {question_template} = require('./templates')
const bodyParser = require('body-parser');
const { createMessageAdapter } = require('@slack/interactive-messages');
const slackInteractions = createMessageAdapter('8972d8dea5ed17e38b06a5624626f0ca');

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// An access token (from your Slack app or custom integration - xoxp, xoxb)
const token = 'xoxb-2086449846178-2091065387445-IUpsAtZAaswYgjX7pGwjWzM9';

const web = new WebClient(token);


(async () => {
  // See: https://api.slack.com/methods/chat.postMessage
  const res = await web.chat.postMessage({ channel: '#creating-chat-bots', text: 'wow', blocks: question_template.blocks });

  // `res` contains information about the posted message
  console.log('Message sent: ', res.ts);
})();



slackInteractions.action('submit_question', (payload, respond) => {
    console.log(payload)
})
 
slackInteractions.start(3002).then(() => {
    // Listening on path '/slack/actions' by default
console.log(`server listening on port ${3002}`);
});
app.listen(3001, () =>
  console.log('Example app listening on port 3001'),
);