// "@furikaeru Aの実装"->DynamoDBに登録（user,text,date）
// "@furikaeru"->振り返りフォーマットにやったことを入れてresponse
// そのフォーマットを元に振り返りを埋める

// OutlookのAPI叩いて明日の予定を取得する
// 明日やることに埋める

// 退勤したら振り返りしたかbotする

const AWS = require('aws-sdk');

const current_time = new Date(); 
const year = current_time.getFullYear();
const month = current_time.getMonth()+1;
const week = current_time.getDay();
const day = current_time.getDate();
const weekday = new Array("日","月","火","水","木","金","土");
const format =
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

exports.handler = async (event) => {
/*    console.log('Received event:', JSON.stringify(event, null, 2));*/

    const eventBody = JSON.parse(event.body);
/*    console.log("eventBody:", eventBody);*/

    // handle challenge
    const challenge = eventBody.challenge;
    if (challenge) {
      const body = {
        challenge: challenge
      };
      const response = {
        statusCode: 200,
        body: JSON.stringify(body)
      };
      return response;
    }

    const text = eventBody.event.text;
    const user = eventBody.event.user;
    const channel = eventBody.event.channel;
    const botProfile = eventBody.event.bot_profile;
    const ts = eventBody.event.ts;

/*    console.log("text:", text);
    console.log("user:", user);
    console.log("channel:", channel);
    console.log("botProfile:", botProfile);*/
    console.log("ts:", ts);

    const isDoneTask = text.includes(process.env["MENTIONED_APP_USER_ID"]) && text.includes(":done:");

    if (isDoneTask) {
      /*AWS.config.update({region: 'ap-northeast-1'});*/
      // Create DynamoDB document client
      let ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

      const task = text.replace("<@U04241MH3FG>", "").replace(":done:", "").trim();
      const dateTime = new Date(ts * 1000);
      const date = dateTime.toLocaleDateString({ timeZone: 'Asia/Tokyo' });
/*      const time = dateTime.toLocaleTimeString({ timeZone: 'Asia/Tokyo' });*/

      console.log("task: ", task);
      console.log("dateTime: ", dateTime);
      console.log(date);
 /*     console.log(time);*/
      
      let params = {
        TableName: 'furikaeru_done_tasks',
        Item: {
          'user': { S: user },
          'unixtime': { N: ts },
          'date': { S: date },
        /*  'time': { S: time },*/
          'task': { S: task }
        }
      };

      console.log('params: ', params);

      await ddb.putItem(params, function(err, data) {
        if (err) {
          console.log("Error", err);
        } else {
          console.log("Success", data);
        }
      }).promise();
      
      return;
    }

  // メンションされたらフォーマットをスレッドで投げる
  if (text === process.env["MENTIONED_APP_USER_ID"]) {
      await postMessage(format, channel, ts);
  }

  // 200を返す。
  const response = {
    statusCode: 200,
    body: 'Hello from Lambda!',
  };
  return response;
};

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
