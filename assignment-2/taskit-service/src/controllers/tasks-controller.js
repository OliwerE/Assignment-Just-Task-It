/**
 * Module for the TasksController.
 *
 * @author Mats Loock
 * @author Oliwer Ellréus
 * @version 2.0.0
 */
import amqplib from 'amqplib'

import { Task } from '../models/task.js'

/**
 * Encapsulates a controller.
 */
export class TasksController {
  /**
   * Class constructor.
   */
  constructor () {
    this.startRabbitmqConnection()
  }

  /**
   * Creates connection to RabbitMQ.
   */
  async startRabbitmqConnection () {
    const retryLimit = 10
    const retryDelay = 5000
    for (let i = 0; i < retryLimit; i++) {
      try {
        this.connection = await amqplib.connect(`amqp://${process.env.RABBITMQ_DEFAULT_USER}:${process.env.RABBITMQ_DEFAULT_PASS}@rabbitmq-service:5672`)
        console.log('Connected to RabbitMQ')
        break
      } catch (err) {
        console.log('Error connecting to RabbitMQ. Retrying in a few seconds...')
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }

    this.notificationChannel = await this.connection.createChannel()

    this.queue = 'notification_queue'
    await this.notificationChannel.assertQueue(this.queue, {
      durable: true
    })
  }

  /**
   * Sends notification to RabbitMQ queue.
   *
   * @param {string} type - Notification type.
   * @param {string} name - Task name.
   */
  async publishNotification (type, name) {
    try {
      const notification = {
        type,
        name,
        message: 'Task notification'
      }
      await this.notificationChannel.sendToQueue(this.queue, Buffer.from(JSON.stringify(notification)))

      console.log('Sent notification:', notification)
    } catch (error) {
      console.error('Error publishing event:', error)
    }
  }

  /**
   * Displays a list of tasks.
   *
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   */
  async index (req, res, next) {
    try {
      const viewData = {
        tasks: (await Task.find())
          .map(task => task.toObject())
      }

      res.render('tasks/index', { viewData })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Returns a HTML form for creating a new task.
   *
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async create (req, res) {
    res.render('tasks/create')
  }

  /**
   * Creates a new task.
   *
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async createPost (req, res) {
    console.log(req.body)
    try {
      const task = new Task({
        description: req.body.description
      })

      await task.save()

      req.session.flash = { type: 'success', text: 'The task was created successfully.' }
      this.publishNotification('created', req.body.description)
      res.redirect('.')
    } catch (error) {
      req.session.flash = { type: 'danger', text: error.message }
      res.redirect('./create')
    }
  }

  /**
   * Returns a HTML form for updating a task.
   *
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async update (req, res) {
    try {
      const task = await Task.findById(req.params.id)

      res.render('tasks/update', { viewData: task.toObject() })
    } catch (error) {
      req.session.flash = { type: 'danger', text: error.message }
      res.redirect('..')
    }
  }

  /**
   * Updates a specific task.
   *
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async updatePost (req, res) {
    try {
      const task = await Task.findById(req.params.id)

      if (task) {
        task.description = req.body.description
        task.done = req.body.done === 'on'

        await task.save()

        req.session.flash = { type: 'success', text: 'The task was updated successfully.' }
        if (req.body.done === 'on') {
          this.publishNotification('completed', req.body.description)
        } else {
          this.publishNotification('uncompleted', req.body.description)
        }
      } else {
        req.session.flash = {
          type: 'danger',
          text: 'The task you attempted to update was removed by another user after you got the original values.'
        }
      }
      res.redirect('..')
    } catch (error) {
      req.session.flash = { type: 'danger', text: error.message }
      res.redirect('./update')
    }
  }

  /**
   * Returns a HTML form for deleting a task.
   *
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async delete (req, res) {
    try {
      const task = await Task.findById(req.params.id)

      res.render('tasks/delete', { viewData: task.toObject() })
    } catch (error) {
      req.session.flash = { type: 'danger', text: error.message }
      res.redirect('..')
    }
  }

  /**
   * Deletes the specified task.
   *
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async deletePost (req, res) {
    try {
      await Task.findByIdAndDelete(req.body.id)

      req.session.flash = { type: 'success', text: 'The task was deleted successfully.' }
      res.redirect('..')
    } catch (error) {
      req.session.flash = { type: 'danger', text: error.message }
      res.redirect('./delete')
    }
  }
}
