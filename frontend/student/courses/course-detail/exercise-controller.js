'use strict';

(function () {
  const ICONS = {
    mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    volume: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    record: '<svg viewBox="0 0 24 24" width="18" height="18" fill="#c91518"><circle cx="12" cy="12" r="6"/></svg>'
  };

  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'cp-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2500);
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function clearExerciseSection() {
    var section = document.getElementById('exerciseSection');
    if (section) section.innerHTML = '';
  }

  function getExerciseSection() {
    var section = document.getElementById('exerciseSection');
    if (!section) {
      section = document.createElement('div');
      section.id = 'exerciseSection';
      section.className = 'cp-exercise-section';
      var player = document.querySelector('.cp-player') || document.body;
      player.appendChild(section);
    }
    return section;
  }

  var ExerciseController = {
    init: function () {
      CoursePlayerState.subscribe(function (state, keys) {
        if (keys && keys.indexOf('currentActivity') !== -1 && state.currentActivity) {
          ExerciseController.renderExercises(state.currentActivity);
        }
      });
    },

    renderExercises: function (activity) {
      if (!activity) return;
      clearExerciseSection();
      var section = getExerciseSection();

      var s = CoursePlayerState.getState();
      if (s.submissionStatus && ['SUBMITTED', 'PROCESSING', 'NEEDS_REVIEW', 'REVIEWED', 'ACCEPTED'].indexOf(s.submissionStatus) !== -1) {
        var readOnly = document.createElement('div');
        readOnly.className = 'cp-exercise-readonly';
        readOnly.textContent = '课程已提交，活动内容不可修改';
        section.appendChild(readOnly);
        return;
      }

      switch (activity.activityType) {
        case 'TEXT':
          ExerciseController.renderTextActivity(activity, section);
          break;
        case 'AUDIO':
          ExerciseController.renderAudioActivity(activity, section);
          break;
        case 'CHOICE':
          ExerciseController.renderChoiceActivity(activity, section);
          break;
        case 'FILL_BLANK':
          ExerciseController.renderFillBlankActivity(activity, section);
          break;
        case 'SPEECH':
        case 'ORAL_PRACTICE':
          ExerciseController.renderOralPractice(activity, section);
          break;
        case 'PRACTICE':
          ExerciseController.renderPracticeLink(activity);
          break;
        case 'VIDEO_INTERACTIVE':
          if (activity.questions && activity.questions.length) {
            activity.questions.forEach(function (q, i) {
              if (q.type === 'CHOICE') {
                ExerciseController.renderChoiceQuestion(q, i, section);
              } else if (q.type === 'FILL_BLANK') {
                ExerciseController.renderFillBlankQuestion(q, i, section);
              }
            });
          }
          break;
        default:
          if (activity.questions && activity.questions.length) {
            activity.questions.forEach(function (q, i) {
              if (q.type === 'CHOICE') {
                ExerciseController.renderChoiceQuestion(q, i, section);
              } else if (q.type === 'FILL_BLANK') {
                ExerciseController.renderFillBlankQuestion(q, i, section);
              }
            });
          }
          break;
      }
    },

    renderTextActivity: function (activity, container) {
      var wrapper = document.createElement('div');
      wrapper.className = 'cp-exercise-text';

      var contentDiv = document.createElement('div');
      contentDiv.className = 'cp-exercise-text-content';
      if (activity.content) {
        if (typeof activity.content === 'string') {
          contentDiv.textContent = activity.content;
        } else if (activity.content.text) {
          contentDiv.textContent = activity.content.text;
        } else if (activity.content.passage) {
          contentDiv.textContent = activity.content.passage;
        }
      } else if (activity.description) {
        contentDiv.textContent = activity.description;
      }
      wrapper.appendChild(contentDiv);

      if (activity.isCompleted) {
        var done = document.createElement('div');
        done.className = 'cp-exercise-feedback correct';
        done.innerHTML = ICONS.check + ' 已确认阅读';
        wrapper.appendChild(done);
      } else {
        var ackBtn = document.createElement('button');
        ackBtn.className = 'cp-exercise-submit';
        ackBtn.textContent = '确认阅读';
        ackBtn.addEventListener('click', function () {
          ackBtn.disabled = true;
          ackBtn.textContent = '提交中…';
          CoursePlayerState.saveActivityAttempt(activity.activityId, 'TEXT', { acknowledged: true }, true)
            .then(function () {
              ackBtn.textContent = '已确认';
              ackBtn.className = 'cp-exercise-feedback correct';
            })
            .catch(function (err) {
              showToast(err && err.message ? err.message : '确认失败');
              ackBtn.disabled = false;
              ackBtn.textContent = '确认阅读';
            });
        });
        wrapper.appendChild(ackBtn);
      }

      container.appendChild(wrapper);
    },

    renderAudioActivity: function (activity, container) {
      var wrapper = document.createElement('div');
      wrapper.className = 'cp-exercise-audio';

      var instructionDiv = document.createElement('div');
      instructionDiv.className = 'cp-exercise-audio-instruction';
      instructionDiv.textContent = activity.instruction || '请收听以下音频内容';
      wrapper.appendChild(instructionDiv);

      var statusDiv = document.createElement('div');
      statusDiv.className = 'cp-exercise-audio-status';
      if (activity.isCompleted) {
        statusDiv.innerHTML = ICONS.check + ' 已完成收听';
        statusDiv.className = 'cp-exercise-feedback correct';
      } else {
        statusDiv.textContent = '播放音频以记录学习进度';
      }
      wrapper.appendChild(statusDiv);

      if (!activity.isCompleted) {
        var saveProgressBtn = document.createElement('button');
        saveProgressBtn.className = 'cp-exercise-submit';
        saveProgressBtn.textContent = '标记完成';
        saveProgressBtn.addEventListener('click', function () {
          saveProgressBtn.disabled = true;
          saveProgressBtn.textContent = '提交中…';
          CoursePlayerState.saveActivityAttempt(activity.activityId, 'AUDIO', {}, true)
            .then(function () {
              saveProgressBtn.textContent = '已完成';
              saveProgressBtn.className = 'cp-exercise-feedback correct';
            })
            .catch(function (err) {
              showToast(err && err.message ? err.message : '保存失败');
              saveProgressBtn.disabled = false;
              saveProgressBtn.textContent = '标记完成';
            });
        });
        wrapper.appendChild(saveProgressBtn);
      }

      container.appendChild(wrapper);
    },

    renderChoiceActivity: function (activity, container) {
      var content = activity.content || {};
      var prompt = content.prompt || activity.instruction || '';
      var options = content.options || [];

      if (!options.length && activity.questions && activity.questions.length) {
        var q = activity.questions[0];
        prompt = q.text || prompt;
        options = q.options || [];
      }

      var wrapper = document.createElement('div');
      wrapper.className = 'cp-exercise-choice';

      if (prompt) {
        var qText = document.createElement('div');
        qText.className = 'cp-exercise-question-text';
        qText.textContent = prompt;
        wrapper.appendChild(qText);
      }

      var optionsDiv = document.createElement('div');
      optionsDiv.className = 'cp-exercise-options';
      var selectedIndex = null;

      options.forEach(function (opt, oi) {
        var optDiv = document.createElement('div');
        optDiv.className = 'cp-exercise-option';
        optDiv.setAttribute('data-option-index', oi);

        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'choice-activity-' + activity.activityId;
        radio.value = oi;

        var label = document.createElement('label');
        label.textContent = typeof opt === 'string' ? opt : (opt.text || opt.label || '');

        optDiv.appendChild(radio);
        optDiv.appendChild(label);

        optDiv.addEventListener('click', function () {
          optionsDiv.querySelectorAll('.cp-exercise-option').forEach(function (el) {
            el.classList.remove('selected');
          });
          optDiv.classList.add('selected');
          radio.checked = true;
          selectedIndex = oi;
        });

        optionsDiv.appendChild(optDiv);
      });

      wrapper.appendChild(optionsDiv);

      var feedback = document.createElement('div');
      feedback.className = 'cp-exercise-feedback';
      feedback.style.display = 'none';
      wrapper.appendChild(feedback);

      if (activity.isCompleted) {
        feedback.style.display = 'block';
        feedback.className = 'cp-exercise-feedback correct';
        feedback.innerHTML = ICONS.check + ' 已完成';
      } else {
        var submitBtn = document.createElement('button');
        submitBtn.className = 'cp-exercise-submit';
        submitBtn.textContent = '提交';
        submitBtn.addEventListener('click', function () {
          if (selectedIndex === null) {
            showToast('请选择一个选项');
            return;
          }
          submitBtn.disabled = true;
          CoursePlayerState.saveActivityAttempt(activity.activityId, 'CHOICE', { answerIndex: selectedIndex }, true)
            .then(function (result) {
              feedback.style.display = 'block';
              if (result.isCorrect === true) {
                feedback.className = 'cp-exercise-feedback correct';
                feedback.innerHTML = ICONS.check + ' 正确！';
              } else if (result.isCorrect === false) {
                feedback.className = 'cp-exercise-feedback incorrect';
                feedback.textContent = '不正确，请重试';
                submitBtn.disabled = false;
                selectedIndex = null;
                optionsDiv.querySelectorAll('.cp-exercise-option').forEach(function (el) {
                  el.classList.remove('selected');
                });
                optionsDiv.querySelectorAll('input[type="radio"]').forEach(function (r) {
                  r.checked = false;
                });
              } else {
                feedback.className = 'cp-exercise-feedback correct';
                feedback.innerHTML = ICONS.check + ' 答案已提交';
              }
            })
            .catch(function (err) {
              showToast(err && err.message ? err.message : '提交答案失败');
              submitBtn.disabled = false;
            });
        });
        wrapper.appendChild(submitBtn);
      }

      container.appendChild(wrapper);
    },

    renderFillBlankActivity: function (activity, container) {
      var content = activity.content || {};
      var prompt = content.prompt || activity.instruction || '';
      var placeholder = content.placeholder || '';

      var wrapper = document.createElement('div');
      wrapper.className = 'cp-exercise-fillblank';

      if (prompt) {
        var qText = document.createElement('div');
        qText.className = 'cp-exercise-question-text';
        qText.textContent = prompt;
        wrapper.appendChild(qText);
      }

      var blanksDiv = document.createElement('div');
      blanksDiv.className = 'cp-exercise-blanks';
      var blankCount = prompt.split('___').length - 1;
      if (blankCount < 1) blankCount = 1;
      var inputs = [];

      for (var b = 0; b < blankCount; b++) {
        var inputGroup = document.createElement('div');
        inputGroup.className = 'cp-exercise-blank-group';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'cp-exercise-blank-input';
        input.placeholder = placeholder || ('空格 ' + (b + 1));
        inputs.push(input);
        inputGroup.appendChild(input);
        blanksDiv.appendChild(inputGroup);
      }

      wrapper.appendChild(blanksDiv);

      var feedback = document.createElement('div');
      feedback.className = 'cp-exercise-feedback';
      feedback.style.display = 'none';
      wrapper.appendChild(feedback);

      if (activity.isCompleted) {
        feedback.style.display = 'block';
        feedback.className = 'cp-exercise-feedback correct';
        feedback.innerHTML = ICONS.check + ' 已完成';
      } else {
        var submitBtn = document.createElement('button');
        submitBtn.className = 'cp-exercise-submit';
        submitBtn.textContent = '提交';
        submitBtn.addEventListener('click', function () {
          var answers = inputs.map(function (inp) { return inp.value.trim(); });
          if (answers.some(function (a) { return a === ''; })) {
            showToast('请填写所有空格');
            return;
          }
          submitBtn.disabled = true;
          CoursePlayerState.saveActivityAttempt(activity.activityId, 'FILL_BLANK', { answers: answers }, true)
            .then(function (result) {
              feedback.style.display = 'block';
              if (result.isCorrect === true) {
                feedback.className = 'cp-exercise-feedback correct';
                feedback.innerHTML = ICONS.check + ' 正确！';
              } else if (result.isCorrect === false) {
                feedback.className = 'cp-exercise-feedback incorrect';
                feedback.textContent = '不正确，请重试';
                submitBtn.disabled = false;
                inputs.forEach(function (inp) { inp.value = ''; });
              } else {
                feedback.className = 'cp-exercise-feedback correct';
                feedback.innerHTML = ICONS.check + ' 答案已提交';
              }
            })
            .catch(function (err) {
              showToast(err && err.message ? err.message : '提交答案失败');
              submitBtn.disabled = false;
            });
        });
        wrapper.appendChild(submitBtn);
      }

      container.appendChild(wrapper);
    },

    renderChoiceQuestion: function (question, index, container) {
      var wrapper = document.createElement('div');
      wrapper.className = 'cp-exercise-choice';
      wrapper.setAttribute('data-index', index);

      var qText = document.createElement('div');
      qText.className = 'cp-exercise-question-text';
      qText.textContent = (index + 1) + '. ' + (question.text || '');
      wrapper.appendChild(qText);

      var optionsDiv = document.createElement('div');
      optionsDiv.className = 'cp-exercise-options';
      var selectedIndex = null;

      (question.options || []).forEach(function (opt, oi) {
        var optDiv = document.createElement('div');
        optDiv.className = 'cp-exercise-option';
        optDiv.setAttribute('data-option-index', oi);

        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'choice-q-' + index;
        radio.value = oi;

        var label = document.createElement('label');
        label.textContent = opt;

        optDiv.appendChild(radio);
        optDiv.appendChild(label);

        optDiv.addEventListener('click', function () {
          optionsDiv.querySelectorAll('.cp-exercise-option').forEach(function (el) {
            el.classList.remove('selected');
          });
          optDiv.classList.add('selected');
          radio.checked = true;
          selectedIndex = oi;
        });

        optionsDiv.appendChild(optDiv);
      });

      wrapper.appendChild(optionsDiv);

      var feedback = document.createElement('div');
      feedback.className = 'cp-exercise-feedback';
      feedback.style.display = 'none';
      wrapper.appendChild(feedback);

      var submitBtn = document.createElement('button');
      submitBtn.className = 'cp-exercise-submit';
      submitBtn.textContent = '提交';
      submitBtn.addEventListener('click', function () {
        if (selectedIndex === null) {
          showToast('请选择一个选项');
          return;
        }
        submitBtn.disabled = true;
        var isCorrect = question.correctIndex !== undefined ? selectedIndex === question.correctIndex : null;

        var s = CoursePlayerState.getState();
        CourseApiAdapter.saveActivityAttempt(s.assignmentId, s.submissionId, s.currentActivityId, {
          attemptType: 'CHOICE',
          answer: selectedIndex,
          isCorrect: isCorrect
        }).then(function () {
          feedback.style.display = 'block';
          if (isCorrect === true) {
            feedback.className = 'cp-exercise-feedback correct';
            feedback.innerHTML = ICONS.check + ' 正确！';
            CoursePlayerState.setActivityCompleted(s.currentActivityId);
          } else if (isCorrect === false) {
            feedback.className = 'cp-exercise-feedback incorrect';
            feedback.textContent = '不正确，请重试';
            submitBtn.disabled = false;
            selectedIndex = null;
            optionsDiv.querySelectorAll('.cp-exercise-option').forEach(function (el) {
              el.classList.remove('selected');
            });
            optionsDiv.querySelectorAll('input[type="radio"]').forEach(function (r) {
              r.checked = false;
            });
          } else {
            feedback.className = 'cp-exercise-feedback';
            feedback.textContent = '答案已提交';
            CoursePlayerState.setActivityCompleted(s.currentActivityId);
          }
        }).catch(function () {
          showToast('提交答案失败');
          submitBtn.disabled = false;
        });
      });

      wrapper.appendChild(submitBtn);
      container.appendChild(wrapper);
    },

    renderFillBlankQuestion: function (question, index, container) {
      var wrapper = document.createElement('div');
      wrapper.className = 'cp-exercise-fillblank';
      wrapper.setAttribute('data-index', index);

      var qText = document.createElement('div');
      qText.className = 'cp-exercise-question-text';
      qText.textContent = (index + 1) + '. ' + (question.text || '');
      wrapper.appendChild(qText);

      var blanksDiv = document.createElement('div');
      blanksDiv.className = 'cp-exercise-blanks';
      var blankCount = (question.text || '').split('___').length - 1;
      if (blankCount < 1) blankCount = 1;
      var inputs = [];

      for (var b = 0; b < blankCount; b++) {
        var inputGroup = document.createElement('div');
        inputGroup.className = 'cp-exercise-blank-group';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'cp-exercise-blank-input';
        input.placeholder = '空格 ' + (b + 1);
        inputs.push(input);
        inputGroup.appendChild(input);
        blanksDiv.appendChild(inputGroup);
      }

      wrapper.appendChild(blanksDiv);

      var feedback = document.createElement('div');
      feedback.className = 'cp-exercise-feedback';
      feedback.style.display = 'none';
      wrapper.appendChild(feedback);

      var submitBtn = document.createElement('button');
      submitBtn.className = 'cp-exercise-submit';
      submitBtn.textContent = '提交';
      submitBtn.addEventListener('click', function () {
        var answers = inputs.map(function (inp) { return inp.value.trim(); });
        if (answers.some(function (a) { return a === ''; })) {
          showToast('请填写所有空格');
          return;
        }
        submitBtn.disabled = true;

        var isCorrect = null;
        if (question.correctAnswers) {
          isCorrect = answers.length === question.correctAnswers.length &&
            answers.every(function (a, i) {
              return a.toLowerCase() === question.correctAnswers[i].toLowerCase();
            });
        }

        var s = CoursePlayerState.getState();
        CourseApiAdapter.saveActivityAttempt(s.assignmentId, s.submissionId, s.currentActivityId, {
          attemptType: 'FILL_BLANK',
          answer: answers,
          isCorrect: isCorrect
        }).then(function () {
          feedback.style.display = 'block';
          if (isCorrect === true) {
            feedback.className = 'cp-exercise-feedback correct';
            feedback.innerHTML = ICONS.check + ' 正确！';
            CoursePlayerState.setActivityCompleted(s.currentActivityId);
          } else if (isCorrect === false) {
            feedback.className = 'cp-exercise-feedback incorrect';
            feedback.textContent = '不正确，请重试';
            submitBtn.disabled = false;
            inputs.forEach(function (inp) { inp.value = ''; });
          } else {
            feedback.className = 'cp-exercise-feedback';
            feedback.textContent = '答案已提交';
            CoursePlayerState.setActivityCompleted(s.currentActivityId);
          }
        }).catch(function () {
          showToast('提交答案失败');
          submitBtn.disabled = false;
        });
      });

      wrapper.appendChild(submitBtn);
      container.appendChild(wrapper);
    },

    renderOralPractice: function (activity, container) {
      var wrapper = document.createElement('div');
      wrapper.className = 'cp-exercise-oral';

      var instruction = document.createElement('div');
      instruction.className = 'cp-exercise-oral-instruction';
      instruction.textContent = activity.instruction || '请朗读以下文本';
      wrapper.appendChild(instruction);

      var demoText = document.createElement('div');
      demoText.className = 'cp-exercise-oral-demo';
      demoText.textContent = activity.demoText || '';
      wrapper.appendChild(demoText);

      var statusDiv = document.createElement('div');
      statusDiv.className = 'cp-exercise-oral-status';

      if (activity.isCompleted) {
        statusDiv.innerHTML = ICONS.check + ' 录音已完成';
        statusDiv.className = 'cp-exercise-feedback correct';
        wrapper.appendChild(statusDiv);
        container.appendChild(wrapper);
        return;
      }

      statusDiv.textContent = '待录音';
      wrapper.appendChild(statusDiv);

      var listenBtn = document.createElement('button');
      listenBtn.className = 'cp-exercise-oral-btn listen';
      listenBtn.innerHTML = ICONS.volume + ' 听示范';
      listenBtn.addEventListener('click', function () {
        showToast('正在播放示范音频…（TTS占位）');
      });
      wrapper.appendChild(listenBtn);

      var recordingState = { status: 'idle', mediaRecorder: null, chunks: [] };
      var recordBtn = document.createElement('button');
      recordBtn.className = 'cp-exercise-oral-btn record';
      recordBtn.innerHTML = ICONS.mic + ' 开始录音';
      recordBtn.addEventListener('click', function () {
        if (recordingState.status === 'idle') {
          navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            recordingState.status = 'recording';
            recordingState.chunks = [];
            statusDiv.textContent = '录音中...';
            statusDiv.className = 'cp-exercise-oral-status recording';
            recordBtn.innerHTML = ICONS.record + ' 停止录音';
            recordBtn.classList.add('recording');

            var mr = new MediaRecorder(stream);
            recordingState.mediaRecorder = mr;
            mr.ondataavailable = function (e) {
              if (e.data && e.data.size > 0) recordingState.chunks.push(e.data);
            };
            mr.onstop = function () {
              stream.getTracks().forEach(function (t) { t.stop(); });
              var blob = new Blob(recordingState.chunks, { type: 'audio/webm' });
              recordingState.chunks = [];
              uploadOralRecording(blob);
            };
            mr.start();
          }).catch(function () {
            showToast('无法访问麦克风');
          });
        } else if (recordingState.status === 'recording' && recordingState.mediaRecorder) {
          recordingState.mediaRecorder.stop();
        }
      });

      function uploadOralRecording(blob) {
        recordingState.status = 'uploading';
        statusDiv.textContent = '上传中...';
        statusDiv.className = 'cp-exercise-oral-status uploading';
        recordBtn.disabled = true;

        var st = CoursePlayerState.getState();
        CourseApiAdapter.initRecording(blob, { enrollmentId: st.enrollmentId, submissionId: st.submissionId })
          .then(function (initResult) {
            return CourseApiAdapter.uploadRecording(initResult.uploadUrl, blob)
              .then(function () { return initResult.recordingId; });
          })
          .then(function (recordingId) {
            return CourseApiAdapter.completeRecording(recordingId);
          })
          .then(function (completeResult) {
            return CourseApiAdapter.linkRecording(
              st.assignmentId, st.submissionId, st.currentActivityId,
              completeResult.recordingId
            );
          })
          .then(function () {
            return CoursePlayerState.saveActivityAttempt(activity.activityId, 'SPEECH', { recorded: true }, true);
          })
          .then(function () {
            recordingState.status = 'completed';
            statusDiv.textContent = '录音完成！';
            statusDiv.className = 'cp-exercise-oral-status completed';
            recordBtn.innerHTML = ICONS.check + ' 已完成';
            recordBtn.disabled = true;
          })
          .catch(function () {
            showToast('录音上传失败，请重试');
            recordingState.status = 'idle';
            statusDiv.textContent = '待录音';
            statusDiv.className = 'cp-exercise-oral-status';
            recordBtn.innerHTML = ICONS.mic + ' 开始录音';
            recordBtn.disabled = false;
            recordBtn.classList.remove('recording');
          });
      }

      wrapper.appendChild(recordBtn);
      container.appendChild(wrapper);
    },

    renderPracticeLink: function (activity) {
      var section = getExerciseSection();
      var state = CoursePlayerState.getState();
      var wrapper = document.createElement('div');
      wrapper.className = 'cp-exercise-practice';

      var name = document.createElement('div');
      name.className = 'cp-exercise-practice-name';
      name.textContent = activity.name || '课后练习';
      wrapper.appendChild(name);

      var desc = document.createElement('div');
      desc.className = 'cp-exercise-practice-desc';
      desc.textContent = activity.description || '完成本活动的课后练习';
      wrapper.appendChild(desc);

      var startBtn = document.createElement('button');
      startBtn.className = 'cp-exercise-practice-btn';
      startBtn.innerHTML = '开始练习 ' + ICONS.arrowRight;
      startBtn.addEventListener('click', function () {
        var latestState = CoursePlayerState.getState();
        var practiceReference = activity.practiceReference || {};
        startBtn.disabled = true;
        startBtn.textContent = '正在创建练习…';
        CourseApiAdapter.startCoursePractice({
          assignmentId: latestState.assignmentId,
          submissionId: latestState.submissionId,
          activityId: activity.activityId,
          practiceDefinitionId: practiceReference.practiceDefinitionId,
          returnTo: window.location.pathname + window.location.search
        }).then(function (result) {
          window.location.href = result.navigateTo;
        }).catch(function (error) {
          showToast(error && error.message ? error.message : '练习启动失败');
          startBtn.disabled = false;
          startBtn.innerHTML = '重试练习 ' + ICONS.arrowRight;
        });
      });
      wrapper.appendChild(startBtn);

      section.appendChild(wrapper);

      // Auto-scroll to practice section on return
      var urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('section') === 'practice') {
        setTimeout(function () {
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    },

    renderAll: function (activity) {
      if (!activity) return;
      clearExerciseSection();
      var section = getExerciseSection();

      if (activity.questions && activity.questions.length) {
        activity.questions.forEach(function (q, i) {
          if (q.type === 'CHOICE') {
            ExerciseController.renderChoiceQuestion(q, i, section);
          } else if (q.type === 'FILL_BLANK') {
            ExerciseController.renderFillBlankQuestion(q, i, section);
          }
        });
      }

      if (activity.activityType === 'ORAL_PRACTICE') {
        ExerciseController.renderOralPractice(activity);
      }

      if (activity.activityType === 'PRACTICE') {
        ExerciseController.renderPracticeLink(activity);
      }
    }
  };

  window.ExerciseController = ExerciseController;
})();
