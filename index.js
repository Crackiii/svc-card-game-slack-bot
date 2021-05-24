const express = require('express')
const cors = require('cors')
const app = express();
const { WebClient } = require('@slack/web-api');
const {question_template, answer_request_template, play_next_card_template, game_over_template} = require('./templates')
const bodyParser = require('body-parser');

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

require('dotenv').config()

const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);
const GAME_CACHE = {
  CURRENT_USER: '',
  PLAYER_1: '',
  PLAYER_2: '',
  CURRENT_CARD: '',
  CARDS_PLAYED: [],
  CURRENT_QUESTION: '',
  CURRENT_MESSAGE: '',
  CURRENT_CHANNEL: ''
}

const exchangePlayers = () =>  {
  if(GAME_CACHE.CURRENT_USER === GAME_CACHE.PLAYER_1) {
    GAME_CACHE.CURRENT_USER = GAME_CACHE.PLAYER_2
  } else {
    GAME_CACHE.CURRENT_USER = GAME_CACHE.PLAYER_1
  }
}


const requestAnswer = async () => {
  exchangePlayers()
  answer_request_template.blocks[0].label.text = GAME_CACHE.PLAYER_2;
  answer_request_template.blocks[0].label.text = GAME_CACHE.CURRENT_QUESTION
  const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_USER, text: 'Question', blocks:  answer_request_template.blocks});
  GAME_CACHE.CURRENT_MESSAGE = postMessageRes.ts
  GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel
}

const deleteMessage = async () => {
  await web.chat.delete({token, ts: GAME_CACHE.CURRENT_MESSAGE, channel: GAME_CACHE.CURRENT_CHANNEL})
}


app.post('/slack/actions', async (req, res) => {
  const body = JSON.parse(req?.body?.payload)
  res.status(200).send('Loading...')
  switch(body.actions[0].action_id) {
    case 'submit_question': {
      const question = body.state.values['typed_question']['typed_question'].value;
      GAME_CACHE.CURRENT_QUESTION = question
      await deleteMessage()
      await requestAnswer()
      break;
    }
    case 'rotate_image': {
      console.log({data:body.actions[0].action_id})
      break;
    }
    case 'submit_answer': {
      await deleteMessage()
      const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_USER, text: 'Question', blocks:  play_next_card_template.blocks});
      GAME_CACHE.CURRENT_MESSAGE = postMessageRes.ts
      GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel
      break;
    }
    case 'load_card': {
      await deleteMessage()
      const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_USER, text: 'Start', blocks: question_template.blocks });
      GAME_CACHE.CURRENT_MESSAGE = postMessageRes.ts
      GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel
      break;
    }
    case 'end_game': {
      await deleteMessage()
      const nextUser = GAME_CACHE.CURRENT_USER === GAME_CACHE.PLAYER_1 ? GAME_CACHE.PLAYER_2 : GAME_CACHE.PLAYER_1;
      const conversationRes = await web.conversations.open({users: `${GAME_CACHE.CURRENT_USER}, ${nextUser}`,token, return_im: true})
      await web.chat.postMessage({ channel: conversationRes.channel.id, text: 'Game Over!', blocks:  game_over_template.blocks});
    }
  }
})

app.post('/commands', async (req, res) => {
  const body = req.body;
  const currentUserId = body.user_id;
  GAME_CACHE.PLAYER_1 = currentUserId;
  GAME_CACHE.CURRENT_USER = currentUserId;
  res.status(200).send('Starting game, please wait...')
  const _user = body.text.replace('@', '')
  const users = await web.users.list({token});
  
  if(users.ok) {
    const argumentUser = users.members.find(user => user.name === _user).id
    GAME_CACHE.PLAYER_2 = argumentUser
    const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_USER, text: 'Start', blocks: question_template.blocks });
    GAME_CACHE.CURRENT_MESSAGE = postMessageRes.ts
    GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel
  }
})

//POST RESULTS TO NEW CHANNEL
// 


app.listen(8001, () =>
  console.log('Example app listening on port 8001'),
);