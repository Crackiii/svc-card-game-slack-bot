const express = require('express')
const cors = require('cors')
const app = express();
const { WebClient } = require('@slack/web-api');
const {question_template, answer_request_template, play_next_card_template, game_over_template} = require('./templates')
const bodyParser = require('body-parser');
const fs = require('fs');
const request = require('request')
const jimp = require('jimp');
require('dotenv').config()
app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const token = process.env.SLACK_TOKEN;
const userToken = process.env.SLACK_USER_TOKEN
const web = new WebClient(token);
const GAME_CACHE = {
  CURRENT_USER: '',
  PLAYER_1: '',
  PLAYER_2: '',
  CURRENT_CARD: '',
  CARDS_PLAYED: [],
  CURRENT_QUESTION: '',
  CURRENT_MESSAGE: '',
  CURRENT_CHANNEL: '',
  ALL_CARDS: [],
  CURRENT_IMAGE_URL: '',
  CURRENT_ROTATED_URL: '',
  ROTATED_CARDS: [],
  PLAYER_1_ANSWERED_CARD: '',
  PLAYER_2_ANSWERED_CARD: '',
  SESSION_DATA: [],
  IS_ROTATED: false,
  CURRENT_IMAGE_URL_USED: '',
  PLAYERS_DATA: []
}


// var dir = './rotated_cards';
// if (!fs.existsSync(dir)){
//     fs.mkdirSync(dir);
// }
// const rotateCards = async (done) => {
//   GAME_CACHE.ALL_CARDS.forEach(async (card) => {
//     jimp.read(`${__dirname}/cards/${card}`).then(image => {
//       image.rotate(180).write(`${__dirname}/${dir}/rotated_${card}`)
//     })
//   })
//   done()
// }
// rotateCards(() => {
// })


//Set all straight cards to game cache
const setAllCards = () => {
  fs.readdirSync('./cards/').forEach(file => GAME_CACHE.ALL_CARDS.push(file));
}

//Set all rotated cards to game cache
const setAllRotatedCards = () => {
  fs.readdirSync('./rotated_cards/').forEach(file => GAME_CACHE.ROTATED_CARDS.push(file));
}

//Flush the Game Cache
const flushGameUrlCache = () => {
  GAME_CACHE.CURRENT_IMAGE_URL = ''
  GAME_CACHE.CURRENT_ROTATED_URL = ''
}

//Get the actual users
const sanitizeParam = (text) => text.split(' ').filter(chunk => /@/gi.test(chunk))

//Filter actual users
const filterActualUsersIds = async (userNames) => {
  const usernames = userNames.map(name => name.replace('@', ''))
  const users = await web.users.list({token});
  const players = users.members.filter(user => usernames.includes(user?.name))
  const playerIds = players.map(user => user.id);
  GAME_CACHE.PLAYERS_DATA = players;

  return playerIds;
}

//Set the initial two players
const setTwoPlayers = async (body) => {
  const userNames = sanitizeParam(body.text);
  const player_1 = body.user_id;
  const [player_2] = await filterActualUsersIds(userNames) 
  GAME_CACHE.PLAYER_1 = player_1;
  GAME_CACHE.CURRENT_USER = player_1;
  GAME_CACHE.PLAYER_2 = player_2
}

//Set the current answer by the current user
const setCurrentAnswer = (body) => {
  const answer = body.state.values['typed_question']['typed_question'].value;
  GAME_CACHE.CURRENT_QUESTION = answer
}

//Set Current URL in Game Cache
const setCurrentUrl = (image, url) => {
  if(image)  {
    GAME_CACHE.CURRENT_ROTATED_URL = url
    GAME_CACHE.CURRENT_IMAGE_URL_USED = url
  } else {
    GAME_CACHE.CURRENT_IMAGE_URL = url
    GAME_CACHE.CURRENT_IMAGE_URL_USED = url
  }
}

//Set / Update the current session data
const setSessionData = () => {
  const player = getCurrentPlayer()
  const {answer, card, cardUrl} = getCurrentSessionData()
  GAME_CACHE.SESSION_DATA.push({
    [player]: {
      answer,
      card,
      cardUrl
    }
  })
}

//Set player's played cards
const setPlayersPlayedCards = () => {
  if(GAME_CACHE.CURRENT_USER === GAME_CACHE.PLAYER_1) {
    GAME_CACHE.PLAYER_1_ANSWERED_CARD = GAME_CACHE.CURRENT_CARD
  } else {
    GAME_CACHE.PLAYER_2_ANSWERED_CARD = GAME_CACHE.CURRENT_CARD
  }
}

//Get whatever the current data is
const getCurrentSessionData = () => {
  const answer = GAME_CACHE.CURRENT_QUESTION
  const card = GAME_CACHE.CURRENT_CARD
  const cardUrl = GAME_CACHE.CURRENT_IMAGE_URL_USED

  return {answer, card, cardUrl}
}

//Get the whole session data
const getSessionData = () => GAME_CACHE.SESSION_DATA

//Delete the current message posted
const deleteMessage = async () => {
  await web.chat.delete({token, ts: GAME_CACHE.CURRENT_MESSAGE, channel: GAME_CACHE.CURRENT_CHANNEL})
}

//Create a conversation between users
const createConversation = async (users) => {
  return await web.conversations.open({users,token, return_im: true})
}

//Get next player in the game
const getNextPlayer = () => GAME_CACHE.CURRENT_USER === GAME_CACHE.PLAYER_1 ? GAME_CACHE.PLAYER_2 : GAME_CACHE.PLAYER_1;

//Get the current player in the game
const getCurrentPlayer = () => {
  return GAME_CACHE.CURRENT_USER === GAME_CACHE.PLAYER_1 ? 'player_1' : 'player_2'
}

//Return boolean to see if both players played the same cards
const playersPlayedTheSameCards = () => {
  return GAME_CACHE.PLAYER_1_ANSWERED_CARD === GAME_CACHE.PLAYER_2_ANSWERED_CARD ? true : false
}

// Check if the file is already uploaded
const isAlreadyUploaded = async () => {
  const files = await new Promise((resolve, reject) => {
    request.post('https://slack.com/api/files.list', {
      formData: {
        token: userToken,
      }
    }, (err, res) => {
      if(err) reject(err)

      resolve(res.body)
    })
  })
  return JSON.parse(files).files;
}

//Create a public URL
const createPublicUrl = (file) => {
  const parsedPermalink = file.permalink_public.split('-');
  const pubSecret = parsedPermalink[parsedPermalink.length - 1];
  const url = file.url_private+`?pub_secret=${pubSecret}`
  return url
}

//Get public URL
const getPublicUrl = async (file) => {
  const sharedPublicURLRes = await web.files.sharedPublicURL({
    file:file.id,
    token: userToken,
  }).catch(err => console.log("Error:", err.data.error));

  if(sharedPublicURLRes && sharedPublicURLRes.ok) {
    return createPublicUrl(sharedPublicURLRes.file)
  } else {
    return createPublicUrl(file)
  }
}

//Upload card to get the public url to image
const uploadCard = async (image) => {

  let img = null;
  if(image) {
    const pattern = new RegExp(`${GAME_CACHE.CURRENT_CARD}`, 'gi')
    img =  GAME_CACHE.ROTATED_CARDS.find(card => pattern.test(card))
  }
  const filename = image ? img : GAME_CACHE.CURRENT_CARD;
  const searchResults = await isAlreadyUploaded()
  let file = searchResults.find(file => file.name === filename)
  const dir = image ? `${__dirname}/rotated_cards/${img}` : `${__dirname}/cards/${GAME_CACHE.CURRENT_CARD}`

  if(!file) { 
    file = await new Promise((resolve, reject) => 
      request.post({
        url: 'https://slack.com/api/files.upload',
        formData: {
            token: userToken,
            title: "Image",
            filename,
            filetype: "auto",
            file: fs.createReadStream(dir)
        },
      }, (err, res) => {
        if(err) {
          reject(err)
          return
        }
        resolve(JSON.parse(res.body))
    }))
  }

  console.log("====>", file)
  
  const url = await getPublicUrl(file)
  setCurrentUrl(image, url)  
  return url
}

//Get random card
const getRandomCard = () => {
  if(GAME_CACHE.CURRENT_CARD) GAME_CACHE.CARDS_PLAYED.push(GAME_CACHE.CURRENT_CARD);

  const allCardsNotPlayed = GAME_CACHE.ALL_CARDS.filter(card => !GAME_CACHE.CARDS_PLAYED.includes(card))
  const randomCard = allCardsNotPlayed[Math.floor(Math.random() * allCardsNotPlayed.length)];

  GAME_CACHE.CURRENT_CARD = randomCard;

  return randomCard
}



//Update the current user
const exchangePlayers = () => {
  setPlayersPlayedCards()
  GAME_CACHE.CURRENT_USER = 
    GAME_CACHE.CURRENT_USER === GAME_CACHE.PLAYER_1 ? GAME_CACHE.PLAYER_2 : GAME_CACHE.PLAYER_1
}

//Let the next player answer the question
const requestNextPlayer = async () => {
  setSessionData()
  if(playersPlayedTheSameCards()) {
    await loadNextCardUI()
    return
  }
  exchangePlayers()
  await loadQuestionUI()
}

//Load the question UI to the current user
const loadQuestionUI = async (imageUrl) => {
  question_template.blocks[0].image_url = imageUrl || GAME_CACHE.CURRENT_IMAGE_URL;
  const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_USER, text: 'Question Asked !', blocks:  question_template.blocks});
  GAME_CACHE.CURRENT_MESSAGE = postMessageRes.ts
  GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel
}

//Load next card ui to ask if the user want to play more
const loadNextCardUI = async () => {
  const postMessageRes = await web.chat.postMessage({ channel: GAME_CACHE.CURRENT_USER, text: 'Next Card ?', blocks:  play_next_card_template.blocks});
  GAME_CACHE.CURRENT_MESSAGE = postMessageRes.ts
  GAME_CACHE.CURRENT_CHANNEL = postMessageRes.channel
}

//Load the game end ui
const loadGameEndUI = async (channel) => {
  await web.chat.postMessage({ channel, text: 'Game Over!', blocks:  game_over_template.blocks});
}

app.post('/slack/actions', async (req, res) => {
  const body = JSON.parse(req?.body?.payload)
  res.status(200).send('Loading...')
  switch(body.actions[0].action_id) {
    case 'submit_question': {
      setCurrentAnswer(body)
      setPlayersPlayedCards()
      await deleteMessage()
      requestNextPlayer()
      break;
    }
    case 'load_card': {
      flushGameUrlCache()
      getRandomCard()
      const imageUrl = await uploadCard(false)
      await deleteMessage()
      await loadQuestionUI(imageUrl)
      break;
    }
    case 'end_game': {
      await deleteMessage()
      const sessionData = getSessionData()
      console.log(sessionData)
      const nextPlayer = getNextPlayer()
      const conversation = await createConversation(`${GAME_CACHE.CURRENT_USER}, ${nextPlayer}`)
      await loadGameEndUI(conversation.channel.id)
      break;
    }
    case 'rotate_image': {
      GAME_CACHE.IS_ROTATED = !GAME_CACHE.IS_ROTATED
      await deleteMessage()
      let imageUrl = null;
      if (!GAME_CACHE.CURRENT_ROTATED_URL.length) {
        imageUrl = await uploadCard(true)
      }
      imageUrl = GAME_CACHE.IS_ROTATED ? GAME_CACHE.CURRENT_ROTATED_URL : GAME_CACHE.CURRENT_IMAGE_URL
      await loadQuestionUI(imageUrl)
      break;
    }
  }
})

app.post('/commands', async (req, res) => {

  res.status(200).send('Starting game, please wait...')
  setAllCards()
  setAllRotatedCards()
  getRandomCard()
  await setTwoPlayers(req.body)
  await loadQuestionUI(await uploadCard(false))
})

app.listen(8001, () =>
  console.log('Example app listening on port 8001'),
);