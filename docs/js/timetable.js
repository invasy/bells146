"use strict";

const LOCALE = "ru-RU";
const TIME_FORMAT = new Intl.NumberFormat(LOCALE, {minimumIntegerDigits: 2});
const DOW = {
  "понедельник": 1,
  "вторник": 2,
  "среда": 3,
  "четверг": 4,
  "пятница": 5,
  "суббота": 6,
  "воскресенье": 0,
};

function dow() {
  return (new Date()).getDay();
}

class Time {
  #minutes = 0;

  constructor(hour, minute) {
    this.#minutes = typeof minute !== "undefined" ? 60 * hour + minute : hour;
  }

  static fromDate(date) {
    return new Time(date.getHours(), date.getMinutes());
  }

  static fromString(s) {
    const [hour, minute] = s.split(":").map((a) => parseInt(a)).slice(0, 2);
    return new Time(hour, minute);
  }

  static now() {
    return Time.fromDate(new Date());
  }

  get hour() { return Math.floor(this.#minutes / 60) % 24; }
  get minute() { return this.#minutes % 60; }
  get second() { return 0; }
  get value() { return this.#minutes; }

  toTimeString(seconds=true) {
    const a = [
      TIME_FORMAT.format(this.hour),
      TIME_FORMAT.format(this.minute),
    ];
    if (seconds) a.push(TIME_FORMAT.format(this.second));
    return a.join(":");
  }

  toString() {
    return this.toTimeString(false);
  }

  add(hours, minutes) {
    return new Time(this.#minutes + (typeof minutes !== "undefined" ? 60 * hours + minutes : hours));
  }

  sub(other) {
    return new Time(this.value - other.value);
  }
}

class Period {
  index;
  start;
  duration;

  constructor(index, start, duration) {
    this.index = index;
    this.start = start;
    this.duration = duration;
  }

  toString() {
    throw new Error(`Method '${this.constructor.name}.toString()' is not implemented!`);
  }

  get end() { return this.start.add(this.duration); }
}

class Lesson extends Period {
  toString() { return `${this.index}-й урок`; }
}

class Break extends Period {
  toString() { return `Перемена (${this.duration} минут)`; }
}

class DayTimetable {
  length = 0;

  #index(time) {
    let a = 0, b = this.length - 1;
    while (a < b) {
      const c = (a + b) >> 1, period = this[c];
      if (time.value < period.start.value) {
        b = c;
      } else if (time.value >= period.end.value) {
        a = c + 1;
      } else {
        return c;
      }
    }
    return a;
  }

  push(period) {
    Array.prototype.push.call(this, period);
  }

  insert(period) {
    const i = this.#index(period.start); console.log(period.start, i);
    Array.prototype.splice.call(this, i, 0, period);
  }

  at(time) {
    if (this.length === 0) return [null, null];
    if (time.value < this.start.value) return [null, this[0]];
    if (time.value >= this.end.value) return [null, null];
    const i = this.#index(time);
    return [this[i], this[i + 1]];
  }

  get start() { return this[0]?.start; }
  get end() { return this[this.length - 1]?.end; }
  get now() { return this.at(Time.now()); }
}

class WeekTimetable {
  length = 0;

  constructor(config) {
    const lesson = config["урок"] || 45;
    const week = config["расписание"];
    for (const day in week) {
      const breaks = week[day]["перемены"];
      const d = new DayTimetable();
      let t = Time.fromString(week[day]["начало"] || "9:00");
      for (const n of Array(7).keys()) {
        d.push(new Lesson(n + 1, t, lesson));
        t = t.add(lesson);
        if (n < breaks.length) {
          const b = breaks[n];
          d.push(new Break(n + 1, t, b));
          t = t.add(b);
        }
      }
      this[DOW[day]] = d; ++this.length;
    }
  }

  get today() { return this[dow()]; }
  get now() { return this.today?.now; }
}

Date.prototype.toDateString = function() {
  return this.toLocaleString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function hint(msg) {
  return `<span class="hint">${msg}</span>`;
}

async function showTimetable(){
  const ids = [
    "today", "now", "period", "time_left",
    "next_label", "next_start", "next_period",
  ];
  const cell = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

  const response = await fetch("/bells146/config.json");
  if (!response.ok) { throw new Error(`Response status: ${response.status}`); }
  const config = await response.json();
  const timetable = new WeekTimetable(config);

  const toastOptions = {delay: config["звонок"] || 5000};
  const toastDiv = document.getElementById("toastDiv");
  const toastTime = document.getElementById("toastTime");
  const toastMsg = document.getElementById("toastMsg");
  const toast = bootstrap.Toast.getOrCreateInstance(toastDiv, toastOptions);
  function showToast(time, msg) {
    toastTime.innerText = time;
    toastMsg.innerText = msg;
    toast.show();
  }

  function showNow() {
    const now = new Date();
    const day = now.getDay();
    const time = Time.fromDate(now);
    const today = timetable[day];
    cell.today.innerText = now.toDateString();
    cell.now.innerText = time;
    if (!today?.length) {
      cell.period.innerHTML = hint("уроков нет");
      const next = timetable[(day + 1) % 7]?.[0];
      cell.time_left.innerHTML = next?.start.add(24, 0).sub(time) || "&mdash;:&mdash;";
      cell.next_label.innerHTML = "Завтра";
      cell.next_start.innerHTML = next?.start || "&nbsp;";
      cell.next_period.innerHTML = next || hint("уроков нет");
    } else if (time.value < today.start.value) {
      cell.period.innerHTML = hint("уроки ещё не начались");
      const next = today[0];
      cell.time_left.innerHTML = next.start.sub(time);
      cell.next_label.innerHTML = "Далее";
      cell.next_start.innerHTML = next.start;
      cell.next_period.innerHTML = next;
    } else if (time.value >= today.end.value) {
      cell.period.innerHTML = hint("уроки закончились");
      const next = timetable[(day + 1) % 7]?.[0];
      cell.time_left.innerHTML = next?.start.add(24, 0).sub(time) || "&mdash;:&mdash;";
      cell.next_label.innerHTML = "Завтра";
      cell.next_start.innerHTML = next?.start || "&nbsp;";
      cell.next_period.innerHTML = next || hint("уроков нет");
    } else {
      const [period, next] = today.at(time);
      cell.period.innerHTML = period;
      cell.time_left.innerHTML = period.end.sub(time);
      cell.next_label.innerHTML = "Далее";
      cell.next_start.innerHTML = next?.start || period.end;
      cell.next_period.innerHTML = next || hint("конец уроков");
      if (now.toLocaleTimeString(LOCALE) === period.start.toTimeString()) {
        showToast(time, period);
      }
    }
  }

  document.getElementById("timetable").style.display = "flex";
  setInterval(showNow, 1000);
  showNow();
}

function onLoaded(fn) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 1);
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

onLoaded(showTimetable);
