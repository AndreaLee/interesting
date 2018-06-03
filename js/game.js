/**
 * Created by lenovo on 2018/5/26.
 */
var Game = function () {
    this.config = {
        isMobile: false,
        background: 0x282828,
        ground: -1,
        fallingSpeed: 0.2,
        cubeColor: 0xbebebe,
        cubeWidth: 4,
        cubeHeight: 2,
        cubeDeep: 4,
        jumperColor: 0x232323,
        jumperWidth: 1,
        jumperHeight: 2,
        jumperDeep: 1
    }
    //game status
    this.score = 0;
    this.size = {
        width: window.innerWidth,
        height: window.innerHeight
    }
    //新的场景，我印象中感觉像画布
    this.scene = new THREE.Scene()
    this.cameraPos = {
        current: new THREE.Vector3(0, 0, 0),//摄像机当前的坐标
        next: new THREE.Vector3()
    }
    //正交投影机，相机位置屏幕左上
    this.camera = new THREE.OrthographicCamera(this.size.width / -80, this.size.width / 80, this.size.height / 80, this.size.height / -80, 0, 5000)
    this.renderer = new THREE.WebGLRenderer({antialias: true})

    this.cubes = []//方块数组
    this.cubeStat = {
        nextDir: ''
    }
    this.jumperStat = {
        ready: false,
        xSpeed: 0,
        ySpeed: 0
    }
    this.falledStat = {
        location: -1,
        distance: 0
    }
    this.fallingStat = {
        speed: 0.2,
        end: false
    }
}
Game.prototype = {
    init: function () {
        this._checkUserAgent();
        this._setCamera();
        this._setRenderer();
        this._setLight();
        this._createCube();
        this._createCube();
        this._createJumper();
        this._updateCamera();
        var self = this;
        var mouseEvents = (self.config.isMobile) ? {
            down: 'touchstart',
            up: 'touchend'
        } : {
            down: 'mousedown',
            up: 'mouseup'
        }
        var canvas = document.querySelector('canvas')
        canvas.addEventListener(mouseEvents.down, function() {
            console.log("hihihi");
            self._handleMousedown()
        })
        // 监听鼠标松开的事件
        canvas.addEventListener(mouseEvents.up, function(evt) {
            self._handleMouseup()
        })
        window.addEventListener('resize',function(){
            self._handleWindowResize()
        })
    },
    //游戏初始化配置
    restart: function () {
        this.score = 0;
        this.cameraPos = {
            current: new THREE.Vector3(0, 0, 0),
            next: new THREE.Vector3()
        }
        this.fallingStat = {
            speed: 0.2,
            end: false
        }
        //delete all cube
        var length = this.cubes.length;
        for (var i = 0; i < length; i++) {
            this.scene.remove(this.cubes.pop());
        }
        //delete jumper
        this.scene.remove(this.jumper);

        this.successCallback(this.score);
        this._createCube();
        this._createCube();
        this._createJumper();
        this._updateCamera();
    },
    //游戏成功的执行函数外部传入
    addSuccessFn: function (fn) {
        this.successCallback = fn;
    },
    addFailedFn: function (fn) {
        this.failedCallback = fn;
    },
    //检查是否为手机端
    _checkUserAgent: function () {
        var n = navigator.userAgent;
        if (n.match(/Android/i) || n.match(/webOS/i) || n.match(/iPhone/i) || n.match(/iPad/i) || n.match(/iPod/i) || n.match(/BlackBerry/i)) {
            this.config.isMobile = true;
        }
    },

    _createHelpers: function () {
        var axesHelper = new THREE.AxesHelper(10);
        this.scene.add(axesHelper)
    },
    _handleWindowResize: function () {
        this._setSize()
        this.camera.left = this.size.width / -80;
        this.camera.right = this.size.width / 80;
        this.camera.top = this.size.height / -80;
        this.camera.bottom = this.size.height / 80;
        this.camera.updateProjectionMatrix()
        this.camera.renderer.setSize(this.size.width, this.size.height)
        this._render();
    },
    /**
     *鼠标按下或触摸开始绑定的函数
     *根据鼠标按下的时间来给 xSpeed 和 ySpeed 赋值
     *@return {Number} this.jumperStat.xSpeed 水平方向上的速度
     *@return {Number} this.jumperStat.ySpeed 垂直方向上的速度
     **/
    _handleMousedown: function() {
        var self = this
        if (!self.jumperStat.ready && self.jumper.scale.y > 0.02) {
            self.jumper.scale.y -= 0.01
            self.jumperStat.xSpeed += 0.004
            self.jumperStat.ySpeed += 0.008
            self._render(self.scene, self.camera)
            requestAnimationFrame(function() {
                self._handleMousedown()
            })
        }
    },
    _handleMouseup: function () {
        var self = this
        //标记鼠标已经松开
        self.jumperStat.ready = true
        //判断jumper是否在方块水平面上，是的话继续运动
        if (self.jumper.position.y >= 1) {
            //jumper根据下一方块位置确定水平运动方向
            if (self.cubeStat.nextDir === 'left') {
                self.jumper.position.x -= self.jumperStat.xSpeed;
            } else {
                self.jumper.position.z -= self.jumperStat.xSpeed;
            }
            self.jumper.position.y += self.jumperStat.ySpeed
            //运动伴随缩放
            if (self.jumper.scale.y < 1) {
                self.jumper.scale.y += 0.2//看起来仿佛蹲下去了
            }
            //jumper在垂直方向上先上升后下
            self.jumperStat.ySpeed -= 0.01
            //每一次变换渲染器都要渲染
            self._render(self.scene, self.camera)
            requestAnimationFrame(function () {//我仿佛见过解决什么问题来？在张鑫旭博客里见过
                self._handleMouseup()
            })
        } else {
            //jumper掉落到方块水平位置，开始充值状态，并开始判断掉落是否成功
            console.log('before check');
            self.jumperStat.ready = false
            self.jumperStat.xSpeed = 0;
            self.jumperStat.ySpeed = 0;
            self.jumper.position.y = 1
            self._checkInCube();
            if (self.falledStat.location === 1) {
                //没掉下去！？？
                console.log('mouseup')
                console.log(self.jumper.position.y);
                self.score++;
                self._createCube();
                self._updateCamera();
                if (self.successCallback) {
                    self.successCallback(self.score)
                }
            } else {
                self._falling();
            }
        }
    },
    /**
     *游戏失败执行的碰撞效果
     *@param {String} dir 传入一个参数用于控制倒下的方向：'rightTop','rightBottom','leftTop','leftBottom','none'
     **/
    _fallingRotate: function (dir) {
     //   console.log('fallingrotate');
        var self = this
        var offset = self.falledStat.distance - self.config.cubeWidth / 2
        var rotateAxis = 'z';
        var rotateAdd = self.jumper.rotation[rotateAxis] + 0.1;//旋转速度
        var rotateTo = self.jumper.rotation[rotateAxis] < Math.PI / 2
        var fallingTo = self.config.ground + self.config.jumperWidth / 2 + offset;
        if (dir === 'rightTop') {
            rotateAxis = 'x';
            rotateTo = self.jumper.rotation[rotateAxis] > -Math.PI / 2;
            rotateAdd = self.jumper.rotation[rotateAxis] - 0.1;
            self.jumper.geometry.translate.z = offset;
        } else if (dir === 'rightBottom') {
            rotateAxis = 'x';
            rotateAdd = self.jumper.rotation[rotateAxis] + 0.1;//旋转速度
            rotateTo = self.jumper.rotation[rotateAxis] < Math.PI / 2;
            self.jumper.geometry.translate.z = -offset;
        } else if (dir === 'leftTop') {
            rotateAxis = 'z';
            rotateAdd = self.jumper.rotation[rotateAxis] + 0.1;
            rotateTo = self.jumper.rotation[rotateAxis] < Math.PI / 2;
            self.jumper.geometry.translate.x = offset;
        } else if (dir === 'leftBottom') {
            rotateAxis = 'z';
            rotateTo = self.jumper.rotation[rotateAxis] > -Math.PI / 2;
            rotateAdd = self.jumper.rotation[rotateAxis] - 0.1;
            self.jumper.geometry.translate.x = -offset;
        } else if(dir==='none') {
            rotateTo=false
            fallingTo=self.config.ground;
        }else{
            throw Error('Arguments Error');
        }
        if (!self.fallingStat.end) {
            if (rotateTo) {
                self.jumper.rotation[rotateAxis] = rotateAdd;
            } else if (self.jumper.position.y > fallingTo) {
                self.jumper.position.y -= self.config.fallingSpeed
            } else {
                self.fallingStat.end = true
            }
            self._render()
            requestAnimationFrame(function() {
                self._falling()
            })
        } else {
            //console.log('call failed');
            if (self.failedCallback) {
                self.failedCallback()
            }
        }
    },
    /**
     *游戏失败进入掉落阶段
     *通过确定掉落的位置来确定掉落效果
     **/
    _falling: function () {
        //console.log('falling in');
        var self = this
        if (self.falledStat.location == 0) {
            self._fallingRotate('none')
        } else if (self.falledStat.location === -10) {
            if (self.cubeStat.nextDir == 'left') {
                self._fallingRotate('leftTop')
            } else {
                self._fallingRotate('rightTop');
            }
        } else if (self.falledStat.location === 10) {
            if (self.cubeStat.nextDir == 'left') {
                if (self.jumper.position.x < self.cubes[self.cubes.length - 1].position.x) {
                    self._fallingRotate('leftTop')
                } else {
                    self._fallingRotate('leftBottom')
                }
            } else {
                if (self.jumper.position.z < self.cubes[self.cubes.length - 1].position.z) {
                    self._fallingRotate('rightTop')
                } else {
                    self._fallingRotate('rightBottom')
                }
            }
        }
    },
    /**
     *判断jumper的掉落位置
     *@return {Number} this.falledStat.location
     * -1 : 掉落在原来的方块，游戏继续
     * -10: 掉落在原来方块的边缘，游戏失败
     *  1 : 掉落在下一个方块，游戏成功，游戏继续
     *  10: 掉落在下一个方块的边缘，游戏失败
     *  0 : 掉落在空白区域，游戏失败
     **/
    _checkInCube: function () {
        if (this.cubes.length > 1) {
            //jumper position
            var point0 = {
                x: this.jumper.position.x,
                z: this.jumper.position.z
            }
            //current cube position
            var pointA = {
                x: this.cubes[this.cubes.length - 1 - 1].position.x,
                z: this.cubes[this.cubes.length - 1 - 1].position.z
            }
            //next cube position
            var pointB = {
                x: this.cubes[this.cubes.length - 1].position.x,
                z: this.cubes[this.cubes.length - 1].position.z
            }
            var distanceS, // jumper和当前方块的坐标轴距离
                distanceL // jumper和下一个方块的坐标轴距离
            // 判断下一个方块相对当前方块的方向来确定计算距离的坐标轴
            if (this.cubeStat.nextDir === 'left') {
                distanceS = Math.abs(point0.x - pointA.x)
                distanceL = Math.abs(point0.x - pointB.x)
            } else {
                distanceS = Math.abs(point0.z - pointA.z)
                distanceL = Math.abs(point0.z - pointB.z)
            }
            var should = this.config.cubeWidth / 2 + this.config.jumperWidth / 2
            //上面这个有什么鬼意义？？jumper和cube宽度不是自己设置的么不应该比较跳的宽度和距离么？
            var result = 0;
            if (distanceS < should) {
                this.falledStat.distance = distanceS;//额，落在当前,distance理解为跳完以后判断位置
                result = distanceS < this.config.cubeWidth / 2 ? -1 : -10; //是不是掉了出去
            } else if (distanceL < should) {
                this.falledStat.distance = distanceL
                // 落在下一个方块，将距离储存起来，并继续判断是否可以站稳
                result = distanceL < this.config.cubeWidth / 2 ? 1 : 10;
            }else{
                result=0;
            }
            this.falledStat.location=result
            console.log(result);
        }
    },
    // 每成功一步, 重新计算摄像机的位置，保证游戏始终在画布中间进行
    _updateCameraPos:function(){
        var lastIndex=this.cubes.length-1;
        var pointA={
            x:this.cubes[lastIndex].position.x,
            z:this.cubes[lastIndex].position.z
        }
        var pointB={
            x:this.cubes[lastIndex-1].position.x,
            z:this.cubes[lastIndex-1].position.z
        }
        var pointR=new THREE.Vector3()
        pointR.x=(pointA.x+pointB.x)/2
        pointR.y=0
        pointR.z=(pointA.z+pointB.z)/2
        this.cameraPos.next=pointR
    },
    // 基于更新后的摄像机位置，重新设置摄像机坐标
    _updateCamera:function(){
        var self=this
        var c={
            x:self.cameraPos.current.x,
            y:self.cameraPos.current.y,
            z:self.cameraPos.current.z
        }
        var n={
            x:self.cameraPos.next.x,
            y:self.cameraPos.next.y,
            z:self.cameraPos.next.z
        }
        if(c.x> n.x|| c.z> n.z){
            self.cameraPos.current.x-=0.1
            self.cameraPos.current.z-=0.1   //他这么设有什么意义么？？
            if(self.cameraPos.current.x-self.cameraPos.next.x<0.05){
                self.cameraPos.current.x=self.cameraPos.next.x
            }
            if(self.cameraPos.current.y-self.cameraPos.next.y<0.05){
                self.cameraPos.current.y=self.cameraPos.next.y
            }
            self.camera.lookAt(new THREE.Vector3(c.x,0, c.z))
            self._render();
            requestAnimationFrame(function(){
                self._updateCamera()    //这的更新频率是什么？？
            })
        }
    },
    //init jumper
    _createJumper:function(){
        var material=new THREE.MeshLambertMaterial({color:this.config.jumperColor})
        var geometry=new THREE.CubeGeometry(this.config.jumperWidth,this.config.jumperHeight,this.config.jumperDeep)
        geometry.translate(0,1,0);
        var mesh=new THREE.Mesh(geometry,material);
        mesh.position.y=1
        this.jumper=mesh
        this.scene.add(this.jumper)
    },
    // 新增一个方块, 新的方块有2个随机方向
    _createCube:function(){
        var material=new THREE.MeshLambertMaterial({color:this.config.cubeColor})
        var geometry=new THREE.CubeGeometry(this.config.cubeWidth,this.config.cubeHeight,this.config.cubeDeep)
        var mesh=new THREE.Mesh(geometry,material)
        if(this.cubes.length){
            var random=Math.random()
            this.cubeStat.nextDir=random>0.5?'left':'right'
            mesh.position.x=this.cubes[this.cubes.length-1].position.x
            mesh.position.y=this.cubes[this.cubes.length-1].position.y
            mesh.position.z=this.cubes[this.cubes.length-1].position.z
            if(this.cubeStat.nextDir==='left'){
                mesh.position.x=this.cubes[this.cubes.length-1].position.x-4*Math.random()-6
            }else{
                mesh.position.z=this.cubes[this.cubes.length-1].position.z-4*Math.random()-6
            }
        }
        this.cubes.push(mesh)
        // 当方块数大于6时，删除前面的方块，因为不会出现在画布中
        if(this.cubes.length>6){
            this.scene.remove(this.cubes.shift())
        }
        this.scene.add(mesh)
        // 每新增一个方块，重新计算摄像机坐标
        if(this.cubes.length>1){
            this._updateCameraPos()
        }
    },
    _render:function(){
        this.renderer.render(this.scene,this.camera)
    },
    _setLight:function(){
        //平行光源，光的颜色，强度(default:1)；对于平行光，光源位置尤其重要
        var directionalLight=new THREE.DirectionalLight(0xffffff,1.1);
        //设置光源位置
        directionalLight.position.set(3,10,5)
        this.scene.add(directionalLight)
        //环境光源
        var light=new THREE.AmbientLight(0xffffff,0.3)
        this.scene.add(light)
    },
    _setCamera:function(){
        this.camera.position.set(100, 100, 100)
        this.camera.lookAt(this.cameraPos.current)
    },
    _setRenderer: function() {
        this.renderer.setSize(this.size.width, this.size.height)
        this.renderer.setClearColor(this.config.background)
        document.body.appendChild(this.renderer.domElement)
    },
    _setSize:function(){
        this.size.width=window.innerWidth,
        this.size.height=window.innerHeight
    }
}