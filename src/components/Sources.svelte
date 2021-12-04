<script>
  import Container from './Container.svelte'
</script>

<Container>
  <h3 class="title">External Sources</h3>
  <div class="horizontal-list">
    <a href="https://www.unwater.org/app/uploads/2020/03/handwashing.png">
      Image
    </a>
    <a href="https://freesound.org/people/muy2149972/sounds/586416/">
      Audio
    </a>
  </div>
</Container>

<style>
  .title {
    text-align: center;
  }

  .horizontal-list {
    display: flex;
    flex-direction: row;
    justify-content: space-evenly;
  }
</style>
