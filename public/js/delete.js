
const deleteProduct = (btn) => {
    const prodId = btn.parentNode.querySelector('[name = productId]').value;
    const csrtToken = btn.parentNode.querySelector('[name = _csrf]').value;
    const clickedBtn = btn.closest('article');

    fetch('/admin/delete-product/'+ prodId, {
        method : 'DELETE',
        headers : {
            'csrf-token' : csrtToken
        }
    })
    .then(result => {
        return result.json()
    })
    .then(data => {
        console.log(data)
        clickedBtn.remove();
    })
    .catch(err => {
        console.log(err)
    });
}