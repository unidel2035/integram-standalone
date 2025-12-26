var script=document.getElementById('ideav');
var iSrc=script.getAttribute("src").split('?url=').pop();
console.log(iSrc);
var obj=new XMLHttpRequest(); // Объявляем переменную под JSON и API по HTTPS
obj.open('GET','https://'+iSrc,true); // Открываем асинхронное соединение заданным методом по нужному адресу
obj.onload=function(e){ // Когда запрос вернет результат - сработает эта функция
    try{ // в this.responseText лежит ответ от сервера
        json=JSON.parse(this.responseText); // Пытаемся разобрать ответ как JSON
    }
    catch(e){ // Если произошла ошибка при разборе JSON
        h=this.responseText;
    }
    var div= document.createElement('div');
    div.innerHTML= this.responseText;
    script.parentNode.insertBefore(div, script);
    obj.abort(); // Закрываем соединение
}
obj.send(); // отправили запрос и теперь будем ждать ответ, а пока - выходим
console.log('');

