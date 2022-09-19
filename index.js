/*----------------------------------------------------------------------*/
/*specifications*/

// "@furikaeru ミナミ定例 :done:"->DynamoDBに登録
// "@furikaeru"->振り返りフォーマットにやったことを入れてスレッドで返す
// ユーザーはそのフォーマットをコピペして振り返りを埋めて投稿できる

// OutlookのAPI叩いて明日の予定を取得する
// 明日やることに埋める

// 退勤したら振り返りしたかbotする

/*----------------------------------------------------------------------*/

const AWS = require('aws-sdk');

/*----------------------------------------------------------------------*/

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const eventBody = JSON.parse(event.body);
  const text = eventBody.event.text;
  const isFurikaeruEvent = text.includes(process.env["MENTIONED_APP_USER_ID"]);
  if (!isFurikaeruEvent) return;

  handleChallenge(eventBody.challenge);

  const user = eventBody.event.user;
  const channel = eventBody.event.channel;
  const ts = eventBody.event.ts;

  // イベント発生の時間を処理する
  const eventDateTime = new Date(ts * 1000);
  // JSTにする
  eventDateTime.setHours(eventDateTime.getHours() + 9);
  
  const year = eventDateTime.getFullYear();
  const month = eventDateTime.getMonth()+1;
  const week = eventDateTime.getDay();
  const day = eventDateTime.getDate();
  
  // 完了タスクの登録のDynamoDB登録処理
  const isDoneTask = text.includes(":done:");

  if (isDoneTask) {
    await putItemDoneTaskInDynamoDB(text, user, ts, year, month, day);
    // TODO: ここにreturn; か？inputDoneTaskInDynamoDB内か？

    console.log("emoji入れていく");
    await addEmoji(text, channel, ts);
  }

  // メンションされたらフォーマットをスレッドで投げる
  if (text === process.env["MENTIONED_APP_USER_ID"]) {
    
    // フォーマットを返す日（今日）の日付をセットする
    // TODO: 指定された日にも対応できるようにしたい
    let targetDateTime = new Date();
    // JSTにする
    targetDateTime.setHours(targetDateTime.getHours() + 9);
    const year = eventDateTime.getFullYear();
    const month = eventDateTime.getMonth()+1;
    const day = eventDateTime.getDate();
    const targetDate = `${year}/${month}/${day}`

    const dataItems = await getDoneTaskDynamoDB(user, targetDate);
    const format = furikaeruFormat(dataItems, month, day, week);

    await postMessage(format, channel, ts);
  }

  // 200を返す。
  const response = {
    statusCode: 200,
    body: 'Hello from Lambda!',
  };
  return response;
};


// handle challenge
const handleChallenge = (challenge) => {
  if (challenge) {
    const body = { challenge: challenge };
    const response = {
      statusCode: 200,
      body: JSON.stringify(body)
    };
  
    return response;
  }
}

/*----------------------------------------------------------------------*/
/*methods*/

const furikaeruFormat = (dataItems, month, day, week) => {
  const weekday = new Array("日","月","火","水","木","金","土");

  let format;
  
  if (dataItems.length === 0) {
  format = 
`${month}/${day}(${weekday[week]})
*今日やったこと*
-  
-  

*明日やること*
-  
-  

*自由記入（ハマったこと、学んだことなど）*
-  
`
  } else {
    let doneTaskList = "";
    dataItems.forEach((element) => {
      doneTaskList += `- ${element.task.S}\n`;
    })
    
    format = 
`${month}/${day}(${weekday[week]})
*今日やったこと*
${doneTaskList}
*明日やること*
-  
-  

*自由記入（ハマったこと、学んだことなど）*
-  
`
  }

  return format;
}

// DynamoDBに完了タスクを書き込む
async function putItemDoneTaskInDynamoDB(text, user, ts, year, month, day) {
  let ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

  const task = text.replace("<@U04241MH3FG>", "").replace(":done:", "").trim();
  
  let params = {
    TableName: 'furikaeru_done_tasks',
    Item: {
      'user':     { S: user },
      'unixtime': { N: ts },
      'date':     { S: `${year}/${month}/${day}` },
      'task':     { S: task }
    }
  };

  await ddb.putItem(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data);
    }
  }).promise();
  
  return;
}

// DynamoDBから完了タスクを取得する
async function getDoneTaskDynamoDB(user, targetDate) {
  let ddb = new AWS.DynamoDB();
  
  let params = {
    ExpressionAttributeValues: {
      ':u': { S: user },
      ':t': { N: '0' },
      ':date': { S: targetDate }
    },
    ExpressionAttributeNames: {"#u":"user", "#d":"date"}, // user & date is reserved in Dynamo
    KeyConditionExpression: "#u = :u and unixtime > :t",
    ProjectionExpression: 'task',
    FilterExpression: 'contains (#d, :date)',
    TableName: 'furikaeru_done_tasks'
  };
  
  let dataItems;
  
  await ddb.query(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success! data.Items: ", data.Items);
      dataItems = data.Items;
    }
  }).promise();
  
  return dataItems;
}

// 指定したchannelに、メッセージを送信する。
async function postMessage(text, channel, ts) {
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': 'Bearer ' + process.env['SLACK_BOT_USER_ACCESS_TOKEN']
  };
  const data = {
    'channel': channel,
    'text': text,
    'thread_ts': ts,
  };
  await sendHttpRequest(process.env['SLACK_POST_MESSAGE_URL'], 'POST', headers, JSON.stringify(data));
}

// 指定したtextにemojiを付ける
async function addEmoji(text, channel, ts) {
  let emoji = selectEmoji();
  let url = `https://slack.com/api/reactions.add`;

  const data = {
    'channel': channel,
    'text': text,
    'timestamp': ts,
    'name': emoji
  };
  
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': 'Bearer ' + process.env['SLACK_BOT_USER_OAUTH_TOKEN']
  };
  console.log("sendHttpRequest!!");
  await sendHttpRequest(url, 'POST', headers, JSON.stringify(data));
}

function selectEmoji() {
  const names = ["otu","tensaida","sasuga", "sugoi", "yaruyan", "emo", "gangan", "subara"];
  const nameIndex = Math.floor( Math.random() * names.length);
  return names[nameIndex];
}

// Httpリクエストを送信する。
async function sendHttpRequest(url, method, headers, bodyData) {
  console.log('sendHttpRequest');
  console.log('url:' + url);
  console.log('method:' + method);
  console.log('headers:' + JSON.stringify(headers));
  console.log('body:' + bodyData);

  const https = require('https');
  const options = {
    method: method,
    headers: headers
  };
  return new Promise((resolve, reject) => {
    let req = https.request(url, options, (res) => {
      console.log('responseStatusCode:' + res.statusCode);
      console.log('responseHeaders:' + JSON.stringify(res.headers));

      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
        console.log('responseBody:' + chunk);
      });
      res.on('end', () => {
        console.log('No more data in response.');
        resolve(body);
      });
    }).on('error', (e) => {
      console.log('problem with request:' + e.message);
      reject(e);
    });
    req.write(bodyData);
    req.end();
  });
}
