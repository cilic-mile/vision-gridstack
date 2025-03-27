// @ts-nocheck
import {Component} from '@angular/core';
import {droppedCB, elementCB, GridstackComponent, GridstackItemComponent, nodesCB} from "gridstack/dist/angular";
import {
  GridStackEngine,
  GridStackMoveOpts,
  GridStackNode,
  GridStackOptions,
  GridStackWidget,
  Utils
} from "gridstack";
import {NgForOf} from "@angular/common";

class CustomEngine extends GridStackEngine {
  public override findEmptyPosition(node, nodeList = this.nodes, column = this.column, after, maxRow = this.maxRow) {
    const start = after ? after.y * column + (after.x + after.w) : 0;
    let found = false;

    // Maximum allowed index based on maxRow constraint
    const maxIndex = maxRow ? column * maxRow : Number.MAX_SAFE_INTEGER;

    for (let i = start; !found; ++i) {
      // If we've exceeded the maximum allowed rows, break and return false
      if (maxRow && i >= maxIndex) {
        console.log(`Could not find position for node within maxRow=${maxRow} constraint`);
        return false;
      }

      const x = i % column;
      const y = Math.floor(i / column);

      // Skip this position if:
      // 1. The node would extend beyond the available columns
      // 2. The node would extend beyond the maxRow
      if (x + node.w > column || (maxRow && y + node.h > maxRow)) {
        continue;
      }

      const box = {x, y, w: node.w, h: node.h};

      // Check if this position collides with any existing node
      if (!nodeList.find(n => Utils.isIntercepted(box, n))) {
        if (node.x !== x || node.y !== y) {
          node._dirty = true;
        }
        node.x = x;
        node.y = y;
        delete node.autoPosition;
        found = true;
      }
    }

    return found;
  }

  public override moveNode(node: GridStackNode, o: GridStackMoveOpts): boolean {
    console.log("moveNode", node, o);
    return super.moveNode(node, o);
  }

  public override moveNodeCheck(node: GridStackNode, o: GridStackMoveOpts): boolean {
    console.log("moveNodeCheck", node, o);
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

    if (!canMove) {
      const collidingNodes = node.grid.engine.collideAll(o).filter(n => n.id !== node.id);

      const nodes = [...node.grid?.engine.nodes].filter(n => n.id !== node.id);
      const clonedNode = {...node, ...o};
      nodes.push(clonedNode);

      const foundPositionForAll = collidingNodes.map(c => this.findEmptyPosition(c, nodes)).every(value => value);
      if (o.resizing || foundPositionForAll) {
        collidingNodes.forEach(collidingNode => {
          // Skip locked nodes
          if (collidingNode.locked) return;

          // Try to find empty space for this node
          const found = this.findEmptyPosition(collidingNode, nodes);

          if (found) {
            console.log(`Moved node ${collidingNode.id} to (${collidingNode.x},${collidingNode.y})`);

            // Update the widget
            node.grid.update(collidingNode.el, {
              x: collidingNode.x,
              y: collidingNode.y
            });
          }
        });
        console.log('collidingNodes', collidingNodes);
        return this.moveNode(node, o);
      }
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
    {x: 0, y: 0, id: '1'},
    {x: 1, y: 0, id: '2'},
    {x: 0, y: 1, id: '3'},
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

  onDragStop($event: elementCB) {
    console.log('drag stop ', $event);

  }
}
