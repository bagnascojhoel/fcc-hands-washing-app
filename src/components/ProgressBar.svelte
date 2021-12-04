<script>
  export let value = 80;
  export let total = 100;
  $: progress = Math.floor(100 / total * value);
</script>


<div class="progress-bar__container">
  <span class="progress-bar__value">{progress}%</span>
  <div class="progress-bar" style={`width: ${progress}%;`}></div>
</div>  

<style>
.progress-bar__container {
  position: relative;
  width: 100%;
  height: 40px;
  margin: 15px 0;
  
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid cadetblue;
}

.progress-bar {
  position: absolute;
  left: 0;
  height: 100%;
  transition: 1s linear;

  background-color: darkgray;
}

.progress-bar__value {
  z-index: 999;
  color: cadetblue;
}
</style>
