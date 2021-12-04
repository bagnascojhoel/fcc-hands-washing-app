<script>
  import {
    Timer,
    Container,
    HowTo,
    Sources,
    WaterRunningAudio
  } from './components'

  let waterRunningAudio;

  function playAudio() {
    waterRunningAudio.play()
  }

  function stopAudio() {
    waterRunningAudio.stop();
  }

</script>

<Container>

  <h1 style="text-align: center;">Hand Washing App</h1>
  <Timer on:start={playAudio} on:end={stopAudio} />
  <HowTo/>
  <Sources/>
  <WaterRunningAudio bind:this={waterRunningAudio}/>
</Container>
