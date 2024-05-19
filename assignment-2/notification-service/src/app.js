/**
 * Module for the notification service.
 *
 * @author Oliwer Ellréus
 * @version 2.0.0
 */

import amqplib from 'amqplib'
import { WebClient } from '@slack/web-api'

// Slack WebClient
const web = new WebClient(process.env.SLACK_TOKEN)

/**
 * Starts notification service.
 */
async function run () {
  try {
    let connection
    const retryLimit = 10
    const retryDelay = 5000
    for (let i = 0; i < retryLimit; i++) {
      try {
        connection = await amqplib.connect(`amqp://${process.env.RABBITMQ_DEFAULT_USER}:${process.env.RABBITMQ_DEFAULT_PASS}@rabbitmq-service:5672`)
        console.log('Connected to RabbitMQ')
        break
      } catch (err) {
        console.log('Error connecting to RabbitMQ. Retrying in a few seconds...')
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }

    const channel = await connection.createChannel()

    const queue = 'notification_queue'
    await channel.assertQueue(queue, {
      durable: true
    })

    // Configure asynchronous single-receiver pattern
    await channel.prefetch(1)

    console.log('Waiting for notifications...')

    channel.consume(queue, async function (msg) {
      console.log('Received notification:', msg.content.toString())

      console.log('Sending message to Slack...')
      const content = JSON.parse(msg.content)
      const type = content.type
      const name = content.name
      await sendMessage(type, name)

      await channel.ack(msg)
    }, {
      noAck: false
    })
  } catch (error) {
    console.error(error)
  }
}
run()

/**
 * Sends message to a Slack channel.
 *
 * @param {string} type - Notification type.
 * @param {string} name - Task name.
 */
const sendMessage = async (type, name) => {
  const message = `${name} was ${type} by oe222ez`

  const res = await web.chat.postMessage({ channel: process.env.SLACK_CHANNEL, text: message })
  console.log(`Successfully sent message to ${res.channel}`)
}
