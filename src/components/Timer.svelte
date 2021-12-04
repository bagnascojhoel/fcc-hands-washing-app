<script>
import {createEventDispatcher} from 'svelte';

import ProgressBar from './ProgressBar.svelte';

const TOTAL_SECONDS = 3;
const dispatch = createEventDispatcher();

let secondsLeft = TOTAL_SECONDS;
$: isRunning = secondsLeft < TOTAL_SECONDS;

function startCountdown() {
  const interval = setInterval(
    () => {
      secondsLeft--;
      
      if (secondsLeft === 0) {
        clearInterval(interval);
        setTimeout(() => {
          dispatch('end')
          secondsLeft = TOTAL_SECONDS
        }, 1200);
      }
    }, 1000)
    
    dispatch('start');
}

</script>

<h2>
  There are {secondsLeft} s left
</h2>
<ProgressBar value={TOTAL_SECONDS - secondsLeft} total={TOTAL_SECONDS}/>
<button 
  on:click={startCountdown}
  disabled={isRunning}
  class="button button--timer"
>
  Start
</button>

<style>
  .button--timer {
    width: 100%;
    background-color: cadetblue;
  }
</style>
