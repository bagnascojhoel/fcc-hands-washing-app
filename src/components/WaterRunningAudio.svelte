<script> 
let audioElement;

export function play() {
  audioElement.play();
}

export function stop() {
  audioElement.pause();
}

</script>

<audio bind:this={audioElement}>
  <source src="water-running-audio.m4a"/>
</audio>
