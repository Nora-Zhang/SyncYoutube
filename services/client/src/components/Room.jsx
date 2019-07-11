import React, { Component } from 'react';
import YouTube from 'react-youtube';
import { Redirect } from 'react-router-dom';
import io from 'socket.io-client';

class Logout extends Component {
  constructor(props) {
    super(props);

    this.state = {
      player: null,
      socket: null,
      progress: 0,
      currTime: '0:00',
      duration: '0:00',
      playState: 'play',
      userList: [],
      videoId: '2g811Eo7K8U'
    }
    this._onReady = this._onReady.bind(this);
    this._onPause = this._onPause.bind(this);
    this._onPlay = this._onPlay.bind(this);
  }

  componentDidMount() {
    this.makeSocketConnection();
  }

  /**
   * helper method that add event listeners to buttons and progress bar
   */
  addEventListeners() {
    const btn = document.querySelector('.control-btn');
    btn.addEventListener('click', () => {
      if (btn.id === 'play') {
        this.state.socket.emit('play_video', {
          time: this.state.player.getCurrentTime()
        });
        this.state.player.playVideo();
      }
      else if (btn.id === 'pause') {
        this.state.socket.emit('pause_video', {
          time: this.state.player.getCurrentTime()
        });
        this.state.player.pauseVideo();
      }
    });

    const progressBar = document.querySelector('.progress');
    progressBar.addEventListener('click', (e) => {
      const bgleft = progressBar.offsetLeft + 24;
      const left = e.pageX - bgleft;
      const bgWidth = progressBar.offsetWidth;
      console.log(`left:${left}  bgWidth:${bgWidth}`);
      const newTime = this.state.player.getDuration() * (left / bgWidth);
      this.state.socket.emit('change_time', {
        time: newTime
      })
      // Skip video to new time.
      this.state.player.seekTo(newTime);
    });

    const videoIdForm = document.querySelector('#videoId-form');
    videoIdForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const videoId = e.target.videoId.value;
      console.log(videoId);
      this.state.socket.emit('change_video', { videoId: videoId });
      this.setState({ videoId: videoId });
    })
  }

  /**
   * helper method that set up socket connection 
   */
  makeSocketConnection() {
    const socket = io('http://localhost:8080');
    // const socket = io();

    // register socket events
    socket.on('connect_failed', () => {
      console.log('Connection Failed');
    });

    // evokes when the client is connected to the sync server
    socket.on('connect', () => {
      console.log('Connected');
      socket.emit('join_room', {
        room: this.props.roomName,
        displayName: this.props.displayName,
        id: socket.id
      });
    });

    // evokes when the client is disconnected from the sync server
    socket.on('disconnect', () => {
      console.log('Disconnected');
    });

    // evokes when some other user join the current room
    socket.on('update_nameList', (data) => {
      console.log('update_nameList');
      this.setState({ userList: data.userList });
    });

    // evokes when some other user join the current room
    // response the server with current play status
    socket.on('get_status', (data) => {
      socket.emit('set_status', {
        id: data.id, // id of the client that just joined
        playState: this.state.playState,
        currTime: this.state.player.getCurrentTime(),
        videoId: this.state.videoId
      });
    });

    // evokes when the server forward the current status in the room
    socket.on('set_status', (data) => {
      console.log(data);
      this.setState({ videoId: data.videoId });
      // console.log(this.state);
      // console.log(this.state.player.getVideoData());
      // console.log(this.state.player.getVideoUrl());
      this.waitFor(_ => data.videoId === this.state.player.getVideoData().video_id && this.state.player.getDuration() !== 0)
        .then(_ => {
          this.state.player.seekTo(data.currTime);
          console.log(this.state.player.getDuration());
          this.setState({ 
            progress: data.currTime / this.state.player.getDuration() * 100,
            currTime: this.formatTime(data.currTime),
            duration: this.formatTime(this.state.player.getDuration())
          })
          if (data.playState === 'pause') {
            this.state.player.playVideo();
          } else if (data.playState === 'play') {
            this.state.player.pauseVideo();
          }
        })
        .catch(err => console.log(err));
    });

    // evokes when some other user pause the video
    socket.on('pause_video', (data) => {
      const currTime = data.time;
      this.state.player.seekTo(currTime);
      this.state.player.pauseVideo();
    });

    // evokes when some other user play the video
    socket.on('play_video', (data) => {
      const currTime = data.time;
      this.state.player.seekTo(currTime);
      this.state.player.playVideo();
    });

    // evokes when some other user click the progress bar
    socket.on('change_time', (data) => {
      const currTime = data.time;
      this.state.player.seekTo(currTime);
    });

    // evokes when some other user changes a video
    socket.on('change_video', (data) => {
      const videoId = data.videoId;
      this.setState({ videoId: videoId });
    })

    // save the socket to the state for future use
    this.setState({ socket: socket });
  }

  /**
   * helper method that updates current time text display.
   */
  updateTimerDisplay() {
    this.setState({
      currTime: this.formatTime(this.state.player.getCurrentTime()),
      duration: this.formatTime(this.state.player.getDuration())
    });
  }

  /**
   * helper method that updates the value of our progress bar accordingly.
   */
  updateProgressBar() {
    let progress = this.state.player.getCurrentTime() / this.state.player.getDuration() * 100;
    if (isNaN(progress)) {
      progress = 0;
    }
    this.setState({
      progress: progress
    })
  }

  /**
   * helper method that format time displayed at the progress bar.
   */
  formatTime(time) {
    time = Math.round(time);
    const minutes = Math.floor(time / 60);
    let seconds = time - minutes * 60;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    return minutes + ":" + seconds;
  }

  _onReady(event) {
    // access to player in all event handlers via event.target
    this.setState({
      player: event.target
    })
    // Update the controls on load
    this.updateTimerDisplay();
    this.updateProgressBar();

    // // Clear any old interval.
    // clearInterval(time_update_interval);

    // Start interval to update elapsed time display and
    // the elapsed part of the progress bar every second.
    setInterval(() => {
      this.updateTimerDisplay();
      this.updateProgressBar();
    }, 1000);

    // register event listeners to buttons
    this.addEventListeners();
    
    // send the sync signal
    this.state.socket.emit('get_status', { id: this.state.socket.id });
  }

  _onPause(event) {
    this.setState({
      playState: 'play'
    })
  }

  _onPlay(event) {
    this.setState({
      playState: 'pause'
    })
  }

  waitFor(conditionFunction) {
    const poll = resolve => {
      if(conditionFunction()) resolve();
      else setTimeout(_ => poll(resolve), 400);
    }
    return new Promise(poll);
  }

  render() {
    const opts = {
      height: '480',
      width: '640',
      playerVars: { // https://developers.google.com/youtube/player_parameters
        autoplay: 1,
        controls: 0,
      }
    };
    // if (!this.props.isAuthenticated) {
    //   return <Redirect to='/login' />
    // } else if (this.props.roomName === '') {
    //   return <Redirect to='/join'/>
    // }
    return (
      <div>
        <div className="columns">
          <div className="column is-2 is-grey-lighter">
            <h3 className="title is-3">Room: {this.props.roomName}</h3>
            <table className="table is-bordered is-striped is-narrow is-hoverable is-fullwidth">
              <thead>
                <tr>
                  <th><abbr title="Position">Pos</abbr></th>
                  <th>Name</th>
                </tr>
              </thead>
              <tfoot>
                <tr>
                  <th><abbr title="Position">Pos</abbr></th>
                  <th>Name</th>
                </tr>
              </tfoot>
              <tbody>
                {
                  this.state.userList.map((user, index) => {
                    return (
                      <tr key={index}>
                        <th>{index+1}</th>
                        <td>{user.displayName}</td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
          <div className="column is-8">
            <YouTube
              videoId={this.state.videoId}
              opts={opts}
              onReady={this._onReady}
              onPause={this._onPause}
              onPlay={this._onPlay}
            />
          </div>
          <div className="column is-2">
            <form id="videoId-form">
              <div className="field has-addons">
                <div className="control">
                  <input className="input" type="text" placeholder="Video Id" name="videoId"/>
                </div>
                <div className="control">
                  <input
                    type="submit"
                    className="button is-primary"
                    value="Find"
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
        <div className="columns">
          <div className="column is-1"></div>
          <div className="column is-1">
            <a className="button control-btn" id={this.state.playState}>
              <span className="icon is-small" >
                <i className={`fas fa-${this.state.playState}`} ></i>
              </span>
            </a>
          </div>
          <div className="column is-8">
            <progress className="progress is-small" value={this.state.progress} max="100"></progress>
          </div>
          <div className="column is-2" style={{ padding: '6px' }}>
            <span>{this.state.currTime}/{this.state.duration}</span>
          </div>
        </div>
      </div >
    )
  };
}

export default Logout;