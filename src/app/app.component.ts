import {Component} from '@angular/core';
import {droppedCB, elementCB, GridstackComponent, GridstackItemComponent, nodesCB} from "gridstack/dist/angular";
import {
  GridStackEngine,
  GridStackMoveOpts,
  GridStackNode,
  GridStackOptions,
  GridStackWidget
} from "gridstack";
import {NgForOf} from "@angular/common";

class CustomEngine extends GridStackEngine {

  public override moveNode(node: GridStackNode, o: GridStackMoveOpts): boolean {
    console.log("moveNode", node, o)
    return super.moveNode(node, o);
  }

  public override moveNodeCheck(node: GridStackNode, o: GridStackMoveOpts): boolean {
    console.log("moveNodeCheck", node, o)
    // initial part copied from super.moveNodeCheck()
    //*****************************************************************************

    // if (node.locked) return false;
    if (!this.changedPosConstrain(node, o))
      return false;
    o.pack = true;
    // simpler case: move item directly...
    if (!this.maxRow) {
      return this.moveNode(node, o);
    }
    // complex case: create a clone with NO maxRow (will check for out of bounds at the end)
    let clonedNode;
    const clone = new GridStackEngine({
      column: this.column,
      float: this.float,
      nodes: this.nodes.map(n => {
        if (n.id === node.id) {
          clonedNode = { ...n };
          return clonedNode;
        }
        return { ...n };
      })
    });
    if (!clonedNode)
      return false;
    // check if we're covering 50% collision and could move, while still being under maxRow or at least not making it worse
    // (case where widget was somehow added past our max #2449)
    const canMove = clone.moveNode(clonedNode, o) && clone.getRow() <= Math.max(this.getRow(), this.maxRow);
    // else check if we can force a swap (float=true, or different shapes) on non-resize
    if (!canMove && !o.resizing && o.collide) {
      const collide = o.collide.el?.gridstackNode; // find the source node the clone collided with at 50%
      if (collide && this.swap(node, collide)) { // swaps and mark dirty
        // this._notify();
        return true;
      }
    }

    //*******************************************************************************

    if (!canMove){
      // move node then onResizeStop event remove underlying nodes
      return this.moveNode(node, o);
    }

    return super.moveNodeCheck(node, o);
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GridstackComponent, GridstackItemComponent, NgForOf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  public gridOptions: GridStackOptions = {margin: 5, column: 4, row: 4, cellHeight: 100, engineClass: CustomEngine}
  public items: GridStackWidget[] = [
    {x:0, y:0, id:'1'},
    {x:1, y:0, id:'2'},
    {x:0, y:1, id:'3'},
  ];

  // called whenever items change size/position/etc..
  public onChange(data: nodesCB) {
    // console.log('change ', data.nodes.length > 1 ? data.nodes : data.nodes[0]);
  }

  public onResizeStop(data: elementCB) {
    console.log('resizestop ', data);
    const node = data.el.gridstackNode;
    const nodesToRemove = node?.grid?.engine.collideAll(node);
    if (nodesToRemove && nodesToRemove.length > 0) {
      alert("remove nodes: " + nodesToRemove?.map(n => n.id).toString())
      nodesToRemove?.forEach(n => {
        // @ts-ignore
        node.grid?.removeWidget(n.el, true);
      });
    }
  }

  // ngFor unique node id to have correct match between our items used and GS
  public identify(index: number, w: GridStackWidget) {
    return w.id; // or use index if no id is set and you only modify at the end...
  }

  onResize(data: elementCB) {
    // console.log('resize ', data);
  }

  onDropped(data: droppedCB) {
    // console.log('drop ', data);
  }
}
