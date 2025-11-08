import './App.css';
import { Dog } from './components/dog';
import { DogSubscription } from './components/dogSubscription';

function App() {
  return (
    <>
      <h1>Query</h1>
      <Dog name="Rufus" />

      <h1>Subscription</h1>
      <DogSubscription name="Rufus" />
    </>
  );
}

export default App;
