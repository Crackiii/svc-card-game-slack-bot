const express = require('express')
const cors = require('cors')
const app = express();
const { WebClient } = require('@slack/web-api');
const {question_template} = require('./templates')
const bodyParser = require('body-parser');

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

require('dotenv').config()

const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);


app.post('/slack/actions', (req, res) => {
  const body = JSON.parse(req?.body?.payload)
  switch(body.actions[0].action_id) {
    case 'submit_question': {
      console.log({data:body.actions[0].action_id, value: body.state.values['typed_question']['typed_question'].value})
      break;
    }
    case 'end_game': {
      console.log({data:body.actions[0].action_id})
      break;
    }
    case 'rotate_image': {
      console.log({data:body.actions[0].action_id})
    }
  }
  res.status(200).send()
})

app.post('/commands', async (req, res) => {
  const body = req.body;
  const currentUserId = body.user_id;
  const _user = body.text.replace('@', '')
  const users = await web.users.list({token});
  res.status(200).send()
  if(users.ok) {
    const argumentUser = users.members.find(user => user.name === _user).id
    const conversationRes = await web.conversations.open({users: `${currentUserId}, ${argumentUser}`, token, return_im: true})
    await web.chat.postMessage({ channel: conversationRes.channel.id, text: 'Start', blocks: question_template.blocks });
  }
})


app.listen(8001, () =>
  console.log('Example app listening on port 8001'),
);