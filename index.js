const express = require('express')
const cors = require('cors')
const app = express();
const { WebClient } = require('@slack/web-api');
const { wait_for_player_template, question_template, play_next_card_template, game_over_template, start_game_template, laoding_card_template } = require('./templates')
const bodyParser = require('body-parser');
const fs = require('fs');
const request = require('request')
const Jimp = require('jimp');
const ObjectsToCsv = require('objects-to-csv')
require('dotenv').config()
app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname))

const token = process.env.SLACK_TOKEN;
const userToken = process.env.SLACK_USER_TOKEN
const web = new WebClient(token);
const GAME_CACHE = {
  CURRENT_USER: '',
  PLAYER_1: {},
  PLAYER_2: {},
  CURRENT_CARD: '',
  CARDS_PLAYED: [],
  CURRENT_QUESTION: '',
  CURRENT_MESSAGE_TS: '',
  CURRENT_CHANNEL: '',
  ALL_CARDS: [],
  CURRENT_IMAGE_URL: '',
  CURRENT_ROTATED_URL: '',
  ROTATED_CARDS: [],
  PLAYER_1_ANSWERED_CARD: '',
  PLAYER_2_ANSWERED_CARD: '',
  SESSION_DATA: [],
  IS_ROTATED: false,
  CURRENT_QUESTION_TS: '',
  URL_USER_HAS_ANSWERED_FOR: '',
  ANYONE_ANSWERED: false
}


const rotateImage = async (card) => {
  const image = await Jimp.read(`./cards/${card}`);
  await image.rotate(180).writeAsync(`./rotated_cards/rotated_${card}`).catch(error => '');
}

//Set all straight cards to game cache
const setAllCards = () => {
  fs.readdirSync('./cards/').forEach(file => GAME_CACHE.ALL_CARDS.push(file));
}
// setAllCards()
const rotateCards = async () => {
  GAME_CACHE.ALL_CARDS.forEach(async (card) => {
    await rotateImage(card)
  })
}
// rotateCards()



//Set all rotated cards to game cache
const setAllRotatedCards = () => {
  fs.readdirSync('./rotated_cards/').forEach(file => GAME_CACHE.ROTATED_CARDS.push(file));
}

//Set the initial two players
const setPlayers = async (body) => {
  const player_1_id = body.user_id;
  const player_2_username = body.text.replace('@', '')
  const users = await web.users.list({ token });
  const player_1 = users.members.find(user => user?.id === player_1_id)
  const player_2 = users.members.find(user => user?.name === player_2_username)
  GAME_CACHE.PLAYER_1 = player_1;
  // GAME_CACHE.CURRENT_USER = player_1;
  GAME_CACHE.PLAYER_2 = player_2

  return { player_1, player_2 }
}

//Set channel
const setChannel = (id) => {
  GAME_CACHE.CURRENT_CHANNEL = id
}

//Set the current answer by the current user
const setCurrentAnswer = (body) => {
  const answer = body.state.values['typed_question']['typed_question'].value;
  GAME_CACHE.CURRENT_QUESTION = answer
}

//Set current user
const setCurrentUser = (id) => {
  GAME_CACHE.CURRENT_USER = GAME_CACHE.PLAYER_1.id === id ? GAME_CACHE.PLAYER_1 : GAME_CACHE.PLAYER_2
}

//Set anyone answered
const setAnyOneAnswered = (answered) => {
  GAME_CACHE.ANYONE_ANSWERED = answered
}

const flushState = () => {
  GAME_CACHE.CURRENT_USER = ''
  GAME_CACHE.CURRENT_QUESTION = ''
  GAME_CACHE.CURRENT_MESSAGE_TS = ''
  GAME_CACHE.CURRENT_IMAGE_URL = ''
  GAME_CACHE.CURRENT_ROTATED_URL = ''
  GAME_CACHE.PLAYER_1_ANSWERED_CARD = ''
  GAME_CACHE.PLAYER_2_ANSWERED_CARD = ''
  GAME_CACHE.IS_ROTATED = false
  GAME_CACHE.CURRENT_QUESTION_TS = ''
  GAME_CACHE.URL_USER_HAS_ANSWERED_FOR = ''
  GAME_CACHE.ANYONE_ANSWERED = false
}

//Set / Update the current session data
const setSessionData = () => {
  // const player = getCurrentPlayer()
  const { answer, card, username, card_url } = getCurrentSessionData()
  GAME_CACHE.SESSION_DATA.push({
    answer,
    card,
    username,
    card_url
  })
}

//Set player's played cards
const setPlayersPlayedCards = (current_player) => {
  if (current_player === GAME_CACHE.PLAYER_1.id) {
    GAME_CACHE.PLAYER_1_ANSWERED_CARD = GAME_CACHE.CURRENT_CARD
  } else {
    GAME_CACHE.PLAYER_2_ANSWERED_CARD = GAME_CACHE.CURRENT_CARD
  }
}

//Get whatever the current data is
const getCurrentSessionData = () => {
  const answer = GAME_CACHE.CURRENT_QUESTION
  const card = GAME_CACHE.CURRENT_CARD
  const card_url = GAME_CACHE.IS_ROTATED ? GAME_CACHE.CURRENT_ROTATED_URL : GAME_CACHE.CURRENT_IMAGE_URL
  const username = GAME_CACHE.CURRENT_USER.real_name

  return { answer, card, card_url, username }
}

//Get the whole session data
const getSessionData = () => GAME_CACHE.SESSION_DATA

//Delete the current message posted
const deleteMessage = async (timestamp) => {
  const ts = timestamp || GAME_CACHE.CURRENT_MESSAGE_TS
  if (ts) {
    await web.chat.delete({ token, ts, channel: GAME_CACHE.CURRENT_CHANNEL })
  }
}

//Create a conversation between users
const createConversation = async (users) => {
  return await web.conversations.open({ users, token, return_im: true })
}


//Get next player in the game
const getNextPlayer = () => GAME_CACHE.CURRENT_USER.id === GAME_CACHE.PLAYER_1.id ? GAME_CACHE.PLAYER_2 : GAME_CACHE.PLAYER_1;

//Get the current player in the game
const getCurrentPlayer = () => {
  return GAME_CACHE.CURRENT_USER.id === GAME_CACHE.PLAYER_1.id ? 'player_1' : 'player_2'
}

//Return boolean to see if both players played the same cards
const playersPlayedTheSameCards = () => {
  return GAME_CACHE.PLAYER_1_ANSWERED_CARD === GAME_CACHE.PLAYER_2_ANSWERED_CARD ? true : false
}

//Upload card to get the public url to image
const uploadCard = async (image) => {

  let img = null;
  if (image) {
    const pattern = new RegExp(`${GAME_CACHE.CURRENT_CARD}`, 'gi')
    img = GAME_CACHE.ROTATED_CARDS.find(card => pattern.test(card))
  }
  const filename = image ? img : GAME_CACHE.CURRENT_CARD;
  const file = image ? `${__dirname}/rotated_cards/${img}` : `${__dirname}/cards/${GAME_CACHE.CURRENT_CARD}`

  const body = await new Promise((resolve, reject) =>
    request.post({
      url: 'https://slack.com/api/files.upload',
      formData: {
        token: userToken,
        title: "Image",
        filename,
        filetype: "auto",
        file: fs.createReadStream(file)
      },
    }, (err, res) => {
      if (err) {
        reject(err)
        return
      }
      resolve(JSON.parse(res.body))
    }))

  const sharedPublicURLRes = await web.files.sharedPublicURL({
    file: body.file.id,
    token: userToken,
  });

  const parsedPermalink = sharedPublicURLRes.file.permalink_public.split('-');
  const pubSecret = parsedPermalink[parsedPermalink.length - 1];
  const url = sharedPublicURLRes.file.url_private + `?pub_secret=${pubSecret}`


  if (image) GAME_CACHE.CURRENT_ROTATED_URL = url
  else GAME_CACHE.CURRENT_IMAGE_URL = url

  return url
}

//Get random card
const getRandomCard = () => {
  if (GAME_CACHE.CURRENT_CARD.length) GAME_CACHE.CARDS_PLAYED.push(GAME_CACHE.CURRENT_CARD);
  const allCardsNotPlayed = GAME_CACHE.ALL_CARDS.filter(card => !GAME_CACHE.CARDS_PLAYED.includes(card))
  const randomCard = allCardsNotPlayed[Math.floor(Math.random() * allCardsNotPlayed.length)];
  GAME_CACHE.CURRENT_CARD = randomCard;
  return randomCard
}


//Upload card to get the public url to image
const uploadCsv = async (name) => {

  const file = `${__dirname}/csv/${name}`

  const body = await new Promise((resolve, reject) =>
    request.post({
      url: 'https://slack.com/api/files.upload',
      formData: {
        token: userToken,
        title: "CSV",
        filename: `${name}`,
        filetype: "auto",
        file: fs.createReadStream(file)
      },
    }, (err, res) => {
      if (err) {
        reject(err)
        return
      }
      resolve(JSON.parse(res.body))
    }))

  const sharedPublicURLRes = await web.files.sharedPublicURL({
    file: body.file.id,
    token: userToken,
  });

  const parsedPermalink = sharedPublicURLRes.file.permalink_public.split('-');
  const pubSecret = parsedPermalink[parsedPermalink.length - 1];
  const url = sharedPublicURLRes.file.url_private + `?pub_secret=${pubSecret}`


  return url
}


//Update the current user
// const exchangePlayers = () => {
//   GAME_CACHE.CURRENT_USER =
//     GAME_CACHE.CURRENT_USER.id === GAME_CACHE.PLAYER_1.id ? GAME_CACHE.PLAYER_2 : GAME_CACHE.PLAYER_1
// }

//Let the next player answer the question
const requestNextPlayer = async () => {
  setSessionData()
  if (playersPlayedTheSameCards()) {
    await loadWaitForFirstPlayerMessage(`Everyone has answered. Thank you.Please press "Play next card" to continue the game.`)
    await loadNextCardUI()
    return
  }
  const text = `${GAME_CACHE.CURRENT_USER.real_name} has answered the Question. ${getNextPlayer().real_name} now it is your turn. Please answer the question that was selected by ${GAME_CACHE.CURRENT_USER.real_name}`
  await loadQuestionUI(GAME_CACHE.IS_ROTATED ? GAME_CACHE.CURRENT_ROTATED_URL : GAME_CACHE.CURRENT_IMAGE_URL, false)
  await loadWaitForFirstPlayerMessage(text)
}

//Load Start game UI
const loadStartGameUI = async (id) => {
  const postMessageRes = await web.chat.postMessage({ channel: id, text: 'Start Game !', blocks: start_game_template.blocks });
  GAME_CACHE.CURRENT_MESSAGE_TS = postMessageRes.ts
  GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel
}

//Load the question UI to the current user
const loadQuestionUI = async (imageUrl, addIamge) => {
  const question_template_copy = Object.assign({}, question_template)
  if (addIamge) {
    question_template.blocks.unshift({ "type": "divider" })
    question_template.blocks.unshift({
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "style": "primary",
          "text": {
            "type": "plain_text",
            "text": "Choose option 2 question",
            "emoji": true
          },
          "value": "click_me_123",
          "action_id": "rotate_image"
        }
      ]
    })
    question_template.blocks.unshift({ "type": "divider" })
    question_template.blocks.unshift({
      "type": "image",
      "title": {
        "type": "plain_text",
        "text": "I Need a Marg",
        "emoji": true
      },
      "image_url": "https://assets3.thrillist.com/v1/image/1682388/size/tl-horizontal_main.jpg",
      "alt_text": "marg"
    })
    question_template_copy.blocks[0].image_url = imageUrl || GAME_CACHE.CURRENT_IMAGE_URL;
  }
  const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_CHANNEL, text: 'Question Asked !', blocks: question_template_copy.blocks });
  GAME_CACHE.CURRENT_QUESTION_TS = postMessageRes.ts
  GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel

  if (addIamge) {
    question_template_copy.blocks.shift()
    question_template_copy.blocks.shift()
    question_template_copy.blocks.shift()
    question_template_copy.blocks.shift()
  }
}

//Load next card ui to ask if the user want to play more
const loadNextCardUI = async () => {
  const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_CHANNEL, text: 'Next Card ?', blocks: play_next_card_template.blocks });
  GAME_CACHE.CURRENT_MESSAGE_TS = postMessageRes.ts
  GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel
}

//Load the game end ui
const loadGameEndUI = async () => {
  await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_CHANNEL, text: 'Game Over!', blocks: game_over_template.blocks });
}

//Load loading UI
const loadLoaderUI = async () => {
  await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_CHANNEL, text: 'Next Card ?', blocks: laoding_card_template.blocks });
}

const generateCSV = async (sessionData) => {
  const csv = new ObjectsToCsv(sessionData)
  const fileName = `data_${Date.now()}.csv`

  await csv.toDisk(`${__dirname}/csv/${fileName}`)

  await uploadCsv(fileName);
}

//const load message 1 ui
const loadWaitForFirstPlayerMessage = async (text, withImage) => {
  if (withImage && !GAME_CACHE.ANYONE_ANSWERED) {
    wait_for_player_template.blocks.push({
      "type": "image",
      "title": {
        "type": "plain_text",
        "text": GAME_CACHE.CURRENT_CARD,
        "emoji": true
      },
      "image_url": GAME_CACHE.IS_ROTATED ? GAME_CACHE.CURRENT_ROTATED_URL : GAME_CACHE.CURRENT_IMAGE_URL,
      "alt_text": "marg"
    })
  }
  wait_for_player_template.blocks.push({
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": text
    }
  })
  const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_CHANNEL, text: 'Please wait :simple_smile:', blocks: wait_for_player_template.blocks });
  GAME_CACHE.CURRENT_MESSAGE_TS = postMessageRes.ts
  wait_for_player_template.blocks = []
}

app.use('/get-files', express.static(__dirname + '/index.html'));

app.post("/", async (req, res) => {
  const files = await web.files.list({ token: userToken, types: 'csv' });
  if (files.ok) {
    res.send(files.files.reverse())
  } else {
    res.send(files)
  }

})

app.post('/slack/actions', async (req, res) => {
  const body = JSON.parse(req?.body?.payload)
  res.status(200).send()
  switch (body.actions[0].action_id) {
    case 'submit_question': {

      setCurrentUser(body.user.id)
      setCurrentAnswer(body)
      setPlayersPlayedCards(body.user.id)
      await loadWaitForFirstPlayerMessage(`*This is ${GAME_CACHE.CURRENT_USER.real_name}'s answer: ${GAME_CACHE.CURRENT_QUESTION}.*`, true)
      await deleteMessage(GAME_CACHE.CURRENT_QUESTION_TS)
      await requestNextPlayer()
      setAnyOneAnswered(true)
      break;
    }
    case 'end_game': {
      setAnyOneAnswered(false)
      await deleteMessage()
      const sessionData = getSessionData()
      await loadGameEndUI()
      generateCSV(sessionData)
      break;
    }
    case 'rotate_image': {
      GAME_CACHE.IS_ROTATED = !GAME_CACHE.IS_ROTATED
      Promise.all([
        await deleteMessage(),
        await deleteMessage(GAME_CACHE.CURRENT_QUESTION_TS)
      ])
      let imageUrl = null;
      if (!GAME_CACHE.CURRENT_ROTATED_URL.length) {
        imageUrl = await uploadCard(true)
      }
      imageUrl = GAME_CACHE.IS_ROTATED ? GAME_CACHE.CURRENT_ROTATED_URL : GAME_CACHE.CURRENT_IMAGE_URL
      const text = `*${GAME_CACHE.CURRENT_USER.real_name}* please pick one of the two questions options and answer the question first. *${getNextPlayer().real_name}*  please wait until *${GAME_CACHE.CURRENT_USER.real_name}* has answered the question, only then answer yourself.`
      Promise.all([
        await loadQuestionUI(imageUrl, true),
        await loadWaitForFirstPlayerMessage(text),
      ])
      break;
    }
    case 'load_card': {
      flushState()
    }
    case 'start_game':
    case 'load_card': {
      setAnyOneAnswered(false)
      setCurrentUser(body.user.id)
      getRandomCard()
      const text = `*${GAME_CACHE.CURRENT_USER.real_name}* please pick one of the two questions options and answer the question first. *${getNextPlayer().real_name}*  please wait until *${GAME_CACHE.CURRENT_USER.real_name}* has answered the question, only then answer yourself.`
      Promise.all([
        await deleteMessage(),
        await loadLoaderUI(),
        await loadQuestionUI(await uploadCard(false), true),
        await loadWaitForFirstPlayerMessage(text)
      ])
      break;
    }
  }
})

app.post('/commands', async (req, res) => {
  res.status(200).send('Starting game, please wait...')
  setAllCards()
  setAllRotatedCards()
  getRandomCard()
  const { player_1, player_2 } = await setPlayers(req.body)
  let conversation = await createConversation(`${player_1.id}, ${player_2.id}`)
  setChannel(conversation.channel.id)
  await loadStartGameUI(conversation.channel.id)
})

app.listen(process.env.PORT || 8001, () =>
  console.log('Example app listening on port 8001'),
);