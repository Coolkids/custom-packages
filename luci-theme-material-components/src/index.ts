import {MDCDrawer} from "@material/drawer";
import { MDCTopAppBar } from "@material/top-app-bar";
import "./styles.scss";

const drawer = MDCDrawer.attachTo(document.querySelector<HTMLElement>('.mdc-drawer')!);
const topAppBar = MDCTopAppBar.attachTo(document.getElementById('app-bar')!);
topAppBar.setScrollTarget(document.getElementById('main-content')!);
topAppBar.listen('MDCTopAppBar:nav', () => {
  drawer.open = !drawer.open;
});
