import classNames from 'classnames'
import React from 'react'
import PropTypes from 'prop-types'
import {
  findKey,
  isEmpty,
  isFunction,
  isString,
  map,
  pick,
  startsWith,
} from 'lodash'

import _ from '../intl'
import Component from '../base-component'
import getEventValue from '../get-event-value'
import Icon from '../icon'
import logError from '../log-error'
import Tooltip from '../tooltip'
import { formatSize } from '../utils'
import { SizeInput } from '../form'
import {
  SelectHost,
  SelectIp,
  SelectNetwork,
  SelectPool,
  SelectRemote,
  SelectResourceSetIp,
  SelectSr,
  SelectSubject,
  SelectTag,
  SelectVgpuType,
  SelectVm,
  SelectVmTemplate,
} from '../select-objects'

import styles from './index.css'

const LONG_CLICK = 400

class Hover extends Component {
  static propTypes = {
    alt: PropTypes.node.isRequired,
  }

  constructor() {
    super()

    this.state = {
      hover: false,
    }

    this._onMouseEnter = () => this.setState({ hover: true })
    this._onMouseLeave = () => this.setState({ hover: false })
  }

  render() {
    if (this.state.hover) {
      return <span onMouseLeave={this._onMouseLeave}>{this.props.alt}</span>
    }

    return <span onMouseEnter={this._onMouseEnter}>{this.props.children}</span>
  }
}

// it supports 'data-*': optional params,
// wich will be passed as an object to the 'onChange' and the 'onUndo' functions
class Editable extends Component {
  static propTypes = {
    onChange: PropTypes.func.isRequired,
    onUndo: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
    useLongClick: PropTypes.bool,
    value: PropTypes.any.isRequired,
  }

  get value() {
    throw new Error('not implemented')
  }

  _onKeyDown = event => {
    const { keyCode } = event
    if (keyCode === 27) {
      return this._closeEdition()
    }

    if (keyCode === 13) {
      return this._save()
    }
  }

  _closeEdition = () => {
    this.setState({ editing: false })
  }

  _openEdition = () => {
    this.setState({
      editing: true,
      error: null,
      saving: false,
    })
  }

  _undo = () => {
    const { props } = this
    const { onUndo } = props
    if (onUndo === false) {
      return
    }

    return this.__save(
      () => this.state.previous,
      isFunction(onUndo) ? onUndo : props.onChange
    )
  }

  _save() {
    return this.__save(() => this.value, this.props.onChange)
  }

  async __save(getValue, saveValue) {
    const { props } = this

    try {
      const value = getValue()
      const previous = props.value
      if (value === previous) {
        return this._closeEdition()
      }

      this.setState({ saving: true })

      const params = Object.keys(props).reduce((res, val) => {
        if (startsWith(val, 'data-')) {
          res[val.slice(5)] = props[val]
        }
        return res
      }, {})

      await saveValue(value, isEmpty(params) ? undefined : params)

      this.setState({ previous })
      this._closeEdition()
    } catch (error) {
      this.setState({
        // `error` may be undefined if the action has been cancelled
        error: error !== undefined && (isString(error) ? error : error.message),
        saving: false,
      })
      logError(error)
    }
  }

  __startTimer = event => {
    event.persist()
    this._timeout = setTimeout(() => {
      event.preventDefault()
      this._openEdition()
    }, LONG_CLICK)
  }
  __stopTimer = () => clearTimeout(this._timeout)

  render() {
    const { state, props } = this

    if (!state.editing) {
      const { onUndo, previous } = state
      const { useLongClick } = props

      const success = <Icon icon='success' />
      return (
        <span
          className={classNames(
            styles.clickToEdit,
            !useLongClick && styles.shortClick
          )}
        >
          <span
            onClick={useLongClick ? undefined : this._openEdition}
            onMouseDown={useLongClick ? this.__startTimer : undefined}
            onMouseUp={useLongClick ? this.__stopTimer : undefined}
          >
            {this._renderDisplay()}
          </span>
          {previous != null &&
            (onUndo !== false ? (
              <Hover
                alt={
                  <a onClick={this._undo}>
                    <Icon icon='undo' />
                  </a>
                }
              >
                {success}
              </Hover>
            ) : (
              success
            ))}
        </span>
      )
    }

    const { error, saving } = state

    return (
      <span>
        {this._renderEdition()}
        {saving && (
          <span>
            {' '}
            <Icon icon='loading' />
          </span>
        )}
        {error != null && (
          <span>
            {' '}
            <Tooltip content={error}>
              <Icon icon='error' />
            </Tooltip>
          </span>
        )}
      </span>
    )
  }
}

export class Text extends Editable {
  static propTypes = {
    autoComplete: PropTypes.string,
    maxLength: PropTypes.number,
    minLength: PropTypes.number,
    pattern: PropTypes.string,
    value: PropTypes.string.isRequired,
  }

  get value() {
    const { input } = this.refs

    // FIXME: should be properly forwarded to the user.
    const error = input.validationMessage
    if (error) {
      throw new Error(error)
    }

    return input.value
  }

  _onInput = ({ target }) => {
    target.style.width = `${target.value.length + 1}ex`
  }

  _renderDisplay() {
    const { children, value } = this.props

    if (children || value) {
      return <span> {children || value} </span>
    }

    const { placeholder, useLongClick } = this.props

    return (
      <span className='text-muted'>
        {placeholder ||
          (useLongClick
            ? _('editableLongClickPlaceholder')
            : _('editableClickPlaceholder'))}
      </span>
    )
  }

  _renderEdition() {
    const { value } = this.props
    const { saving } = this.state

    // Optional props that the user may set on the input.
    const extraProps = pick(this.props, [
      'autoComplete',
      'maxLength',
      'minLength',
      'pattern',
    ])

    return (
      <input
        {...extraProps}
        autoFocus
        defaultValue={value}
        onBlur={this._closeEdition}
        onInput={this._onInput}
        onKeyDown={this._onKeyDown}
        readOnly={saving}
        ref='input'
        style={{
          width: `${value.length + 1}ex`,
          maxWidth: '50ex',
        }}
        type={this._isPassword ? 'password' : 'text'}
      />
    )
  }
}

export class Password extends Text {
  // TODO: this is a hack, this class should probably have a better
  // implementation.
  _isPassword = true
}

export class Number extends Component {
  static propTypes = {
    nullable: PropTypes.bool,
    value: PropTypes.number,
  }

  get value() {
    return +this.refs.input.value
  }

  _onChange = (value, params) => {
    if (value === '') {
      if (this.props.nullable) {
        value = null
      } else {
        return
      }
    } else {
      value = +value
    }

    this.props.onChange(value, params)
  }

  render() {
    const { value } = this.props
    return (
      <Text
        {...this.props}
        onChange={this._onChange}
        value={value === null ? '' : String(value)}
      />
    )
  }
}

export class Select extends Editable {
  static propTypes = {
    options: PropTypes.oneOfType([PropTypes.array, PropTypes.object])
      .isRequired,
    renderer: PropTypes.func,
  }

  componentWillReceiveProps(props) {
    if (
      props.value !== this.props.value ||
      props.options !== this.props.options
    ) {
      this.setState({
        valueKey: findKey(props.options, option => option === props.value),
      })
    }
  }

  get value() {
    return this.props.options[this.state.valueKey]
  }

  _onChange = event => {
    this.setState({ valueKey: getEventValue(event) }, this._save)
  }

  _optionToJsx = (option, key) => {
    const { renderer } = this.props

    return (
      <option key={key} value={key}>
        {renderer ? renderer(option) : option}
      </option>
    )
  }

  _onEditionMount = ref => {
    // Seems to work in Google Chrome (not in Firefox)
    ref && ref.dispatchEvent(new window.MouseEvent('mousedown'))
  }

  _renderDisplay() {
    const { children, renderer, value } = this.props

    return children || <span>{renderer ? renderer(value) : value}</span>
  }

  _renderEdition() {
    const { saving, valueKey } = this.state
    const { options } = this.props

    return (
      <select
        autoFocus
        className={classNames('form-control', styles.select)}
        onBlur={this._closeEdition}
        onChange={this._onChange}
        onKeyDown={this._onKeyDown}
        readOnly={saving}
        ref={this._onEditionMount}
        value={valueKey}
      >
        {map(options, this._optionToJsx)}
      </select>
    )
  }
}

const MAP_TYPE_SELECT = {
  host: SelectHost,
  ip: SelectIp,
  network: SelectNetwork,
  pool: SelectPool,
  remote: SelectRemote,
  resourceSetIp: SelectResourceSetIp,
  SR: SelectSr,
  subject: SelectSubject,
  tag: SelectTag,
  vgpuType: SelectVgpuType,
  VM: SelectVm,
  'VM-template': SelectVmTemplate,
}

export class XoSelect extends Editable {
  static propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  }

  get value() {
    return this.state.value
  }

  _renderDisplay() {
    return (
      this.props.children || (
        <span>{this.props.value[this.props.labelProp]}</span>
      )
    )
  }

  _onChange = object => this.setState({ value: object }, object && this._save)

  _renderEdition() {
    const { saving, xoType, ...props } = this.props

    const Select = MAP_TYPE_SELECT[xoType]
    if (process.env.NODE_ENV !== 'production') {
      if (!Select) {
        throw new Error(`${xoType} is not a valid XoSelect type.`)
      }
    }

    // Anchor is needed so that the BlockLink does not trigger a redirection
    // when this element is clicked.
    return (
      <a onBlur={this._closeEdition}>
        <Select
          {...props}
          autoFocus
          disabled={saving}
          onChange={this._onChange}
        />
      </a>
    )
  }
}

export class Size extends Editable {
  static propTypes = {
    value: PropTypes.number.isRequired,
  }

  get value() {
    return this.refs.input.value
  }

  _renderDisplay() {
    return this.props.children || formatSize(this.props.value)
  }

  _closeEditionIfUnfocused = () => {
    this._focused = false
    setTimeout(() => {
      !this._focused && this._closeEdition()
    }, 10)
  }

  _focus = () => {
    this._focused = true
  }

  _renderEdition() {
    const { saving } = this.state
    const { value } = this.props

    return (
      <span
        // SizeInput uses `input-group` which makes it behave as a block element (display: table).
        // `form-inline` to use it as an inline element
        className='form-inline'
        onBlur={this._closeEditionIfUnfocused}
        onFocus={this._focus}
        onKeyDown={this._onKeyDown}
      >
        <SizeInput
          autoFocus
          className={styles.size}
          ref='input'
          readOnly={saving}
          defaultValue={value}
        />
      </span>
    )
  }
}
