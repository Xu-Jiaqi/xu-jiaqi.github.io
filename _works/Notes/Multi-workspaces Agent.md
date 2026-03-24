以结构化输入输出的方式为agent人为地划分工作区（workspace），每个工作区执行固定任务，固定context长度，每个工作区输入输出相互独立。例如：


```
{
    'general_terminal': {
     "type": "terminal",
     "specification": "",
     "other_features": {...},
     "state": "(base) nansea@nansea-Notebook-PC:~\$ "
    },
    'tmux':{
     "type": "terminal",
     "specification": "terminal for long-term tasks",
     "other_features": {...},
     "state": "(base) nansea@nansea-Notebook-PC:~\$

        [0] 0:bash* "nansea" 19:58 24-3月-26",
    },
    'user': {

        "prompt": "关闭tmux，看看当前目录下的所有文件"

    }

}
```


